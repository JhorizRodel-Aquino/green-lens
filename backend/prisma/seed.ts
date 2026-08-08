import bcrypt from 'bcrypt';
import { prisma } from '../src/lib/prisma';
import { resolveJurisdiction, NotInPhilippinesError } from '../src/services/jurisdiction';

async function seedUser(data: {
    name: string; email: string; password: string; role: 'SUPER_ADMIN' | 'ADMIN' | 'LGU_AGENT';
    regionCode?: string; regionName?: string;
    provinceCode?: string; provinceName?: string;
    municipalityCode?: string; municipalityName?: string;
}) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
        console.log(`Already exists: ${data.email}`);
        return;
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    await prisma.user.create({
        data: {
            name: data.name, email: data.email, passwordHash, role: data.role, status: 'ACTIVE',
            regionCode: data.regionCode, regionName: data.regionName,
            provinceCode: data.provinceCode, provinceName: data.provinceName,
            municipalityCode: data.municipalityCode, municipalityName: data.municipalityName,
        },
    });
    console.log(`Seeded ${data.role}: ${data.email} / ${data.password}`);
}

const FLAG_REASONS = ['FALSE_REPORT', 'DUPLICATE_REPORT', 'MINOR_LITTER', 'ALREADY_RESOLVED', 'PRIVATE_PROPERTY'] as const;
type ReportStatus = 'PENDING' | 'REPORTED' | 'RESOLVED' | typeof FLAG_REASONS[number];

function daysAgo(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
}

function hoursAgo(n: number): Date {
    const d = new Date();
    d.setHours(d.getHours() - n);
    return d;
}

async function seedReport(data: {
    lat: number; lng: number; details: string;
    severity?: 'HIGH' | 'LOW'; imageUrls?: string[];
    status?: ReportStatus; createdAt?: Date; resolvedAt?: Date;
    // If set, the report was resolved and then reopened: final status is REPORTED (not
    // RESOLVED), resolvedAt is cleared, and both a RESOLUTION and a REOPEN note are attached.
    reopenNote?: string; reopenedAt?: Date;
}) {
    const existing = await prisma.report.findFirst({ where: { lat: data.lat, lng: data.lng, details: data.details } });
    if (existing) {
        console.log(`Already exists: report at ${data.lat},${data.lng}`);
        return;
    }

    try {
        const jurisdiction = await resolveJurisdiction(data.lat, data.lng);
        const imageUrls = data.imageUrls ?? ['https://placehold.co/600x400?text=Report'];
        const wasReopened = Boolean(data.reopenNote);
        const status = wasReopened ? 'REPORTED' : (data.status ?? 'PENDING');
        const isResolved = status === 'RESOLVED';
        const isFlagged = (FLAG_REASONS as readonly string[]).includes(status);
        const createdAt = data.createdAt ?? new Date();
        const resolvedAt = isResolved ? (data.resolvedAt ?? createdAt) : null;

        const report = await prisma.report.create({
            data: {
                lat: data.lat, lng: data.lng, details: data.details,
                severity: data.severity,
                images: {
                    create: [
                        ...imageUrls.map((url) => ({ url, kind: 'USER_UPLOAD' as const })),
                        ...(isResolved || wasReopened ? [{ url: 'https://placehold.co/600x400?text=Resolved', kind: 'RESOLUTION_PROOF' as const }] : []),
                    ],
                },
                notes: wasReopened ? {
                    create: [
                        { text: 'Resolved and cleared by LGU crew.', kind: 'RESOLUTION' as const, createdAt: data.resolvedAt ?? createdAt },
                        { text: data.reopenNote as string, kind: 'REOPEN' as const, createdAt: data.reopenedAt ?? new Date() },
                    ],
                } : undefined,
                ...jurisdiction,
                statusValue: status,
                createdAt,
                resolvedAt,
                flaggedAt: isFlagged ? createdAt : null,
                lguActionLogged: isResolved || isFlagged || wasReopened,
            },
        });
        console.log(`Seeded report ${report.id}: ${jurisdiction.locationLabel} (${wasReopened ? 'REOPENED' : status})`);
    } catch (err) {
        if (err instanceof NotInPhilippinesError) {
            console.log(`Skipped report at ${data.lat},${data.lng}: outside PH`);
            return;
        }
        throw err;
    }
}

async function main() {
    await seedUser({
        name: 'Super Admin',
        email: process.env.SEED_SUPER_ADMIN_EMAIL ?? 'superadmin@greenlens.local',
        password: process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'change-me-immediately',
        role: 'SUPER_ADMIN',
    });

    // Demo accounts for quick login on the login page.
    await seedUser({
        name: 'Demo Admin',
        email: 'admin@greenlens.local',
        password: 'admin123',
        role: 'ADMIN',
        regionCode: '040000000', regionName: 'Region IV-A - CALABARZON',
    });

    await seedUser({
        name: 'Demo LGU Agent (Naic)',
        email: 'lgu.naic@greenlens.local',
        password: 'naic123',
        role: 'LGU_AGENT',
        regionCode: '040000000', regionName: 'Region IV-A - CALABARZON',
        provinceCode: '042100000', provinceName: 'Cavite',
        municipalityCode: '042115000', municipalityName: 'Naic',
    });

    // Reports — real GPS coords, reverse geocoded live via Nominatim on seed.
    // Scoped to just the three target cities: City of Manila, Mandaluyong, and Naic.
    await seedReport({ lat: 14.3167, lng: 120.7667, details: 'Open dumping near the public market.', severity: 'HIGH' });
    await seedReport({ lat: 14.339, lng: 120.762, details: 'Uncollected trash pile along the barangay road.', severity: 'LOW' });
    await seedReport({ lat: 14.5995, lng: 120.9842, details: 'Garbage overflow at a Manila street corner.', severity: 'HIGH' });
    await seedReport({ lat: 14.5794, lng: 121.0359, details: 'Illegal dumping along a Mandaluyong side street.', severity: 'LOW' });

    // Seed several months of history per city so the dashboard's grades/leaderboards/trends
    // have real variance to show.
    const NCR_CITIES = [
        { name: 'Manila', lat: 14.5995, lng: 120.9842 },
        { name: 'Mandaluyong', lat: 14.5794, lng: 121.0359 },
        { name: 'Naic', lat: 14.3167, lng: 120.7667 },
    ];

    const STATUS_CYCLE: { status: ReportStatus; resolvedDaysAfter?: number }[] = [
        { status: 'RESOLVED', resolvedDaysAfter: 1 },
        { status: 'RESOLVED', resolvedDaysAfter: 4 },
        { status: 'REPORTED' },
        { status: 'PENDING' },
        { status: 'RESOLVED', resolvedDaysAfter: 2 },
        { status: 'FALSE_REPORT' },
        { status: 'RESOLVED', resolvedDaysAfter: 6 },
        { status: 'MINOR_LITTER' },
        { status: 'RESOLVED', resolvedDaysAfter: 3 },
    ];

    let cycleIndex = 0;
    for (const city of NCR_CITIES) {
        for (let month = 0; month < 5; month++) {
            for (let i = 0; i < 3; i++) {
                const cycle = STATUS_CYCLE[cycleIndex % STATUS_CYCLE.length];
                cycleIndex++;

                // Deterministic offset (not random) so re-running the seed stays idempotent.
                const offset = ((month * 3 + i) % 5 - 2) * 0.004;
                const createdAt = daysAgo(month * 30 + i * 8 + 2);
                const resolvedAt = cycle.resolvedDaysAfter
                    ? new Date(createdAt.getTime() + cycle.resolvedDaysAfter * 24 * 60 * 60 * 1000)
                    : undefined;

                await seedReport({
                    lat: city.lat + offset,
                    lng: city.lng - offset,
                    details: `Illegal dumping reported near ${city.name} (batch ${month}-${i}).`,
                    severity: i % 2 === 0 ? 'HIGH' : 'LOW',
                    status: cycle.status,
                    createdAt,
                    resolvedAt,
                });
            }
        }
    }

    // Freshly submitted, still-pending reports (must be < 24h old — a report auto-flips to
    // REPORTED past that, per the PENDING_TIMEOUT_MS check on every GET /api/reports).
    let pendingIndex = 0;
    for (const city of NCR_CITIES) {
        const offset = (pendingIndex % 5 - 2) * 0.005;
        pendingIndex++;
        await seedReport({
            lat: city.lat + offset,
            lng: city.lng - offset,
            details: `New report near ${city.name}: trash left uncollected overnight.`,
            severity: pendingIndex % 2 === 0 ? 'HIGH' : 'LOW',
            status: 'PENDING',
            createdAt: hoursAgo(pendingIndex * 3),
        });
    }

    // Extra spread within City of Manila specifically, across its districts.
    const MANILA_SPOTS: { name: string; lat: number; lng: number }[] = [
        { name: 'Tondo', lat: 14.6180, lng: 120.9678 },
        { name: 'Sampaloc', lat: 14.6090, lng: 120.9930 },
        { name: 'Ermita', lat: 14.5820, lng: 120.9830 },
        { name: 'Malate', lat: 14.5690, lng: 120.9910 },
        { name: 'Binondo', lat: 14.6000, lng: 120.9740 },
        { name: 'Sta. Ana', lat: 14.5780, lng: 121.0110 },
    ];
    const MANILA_CYCLE: { status: ReportStatus; resolvedDaysAfter?: number }[] = [
        { status: 'PENDING' },
        { status: 'RESOLVED', resolvedDaysAfter: 2 },
        { status: 'REPORTED' },
        { status: 'RESOLVED', resolvedDaysAfter: 4 },
        { status: 'FALSE_REPORT' },
        { status: 'RESOLVED', resolvedDaysAfter: 1 },
    ];
    for (let i = 0; i < MANILA_SPOTS.length; i++) {
        const spot = MANILA_SPOTS[i];
        const cycle = MANILA_CYCLE[i % MANILA_CYCLE.length];
        const createdAt = cycle.status === 'PENDING' ? hoursAgo(4 + i * 2) : daysAgo(i * 3 + 1);
        const resolvedAt = cycle.resolvedDaysAfter
            ? new Date(createdAt.getTime() + cycle.resolvedDaysAfter * 24 * 60 * 60 * 1000)
            : undefined;

        await seedReport({
            lat: spot.lat,
            lng: spot.lng,
            details: `Uncollected garbage reported in ${spot.name}, Manila.`,
            severity: i % 2 === 0 ? 'HIGH' : 'LOW',
            status: cycle.status,
            createdAt,
            resolvedAt,
        });
    }

    // Reopened reports — citizen wasn't satisfied with the resolution and reopened it.
    const REOPENED_SPOTS: { name: string; lat: number; lng: number; reopenNote: string }[] = [
        { name: 'Manila', lat: 14.6020, lng: 120.9810, reopenNote: 'Only half the pile was cleared, rest was left behind.' },
        { name: 'Mandaluyong', lat: 14.5760, lng: 121.0330, reopenNote: 'New dumping happened again the next day at the same spot.' },
        { name: 'Naic', lat: 14.3190, lng: 120.7640, reopenNote: "Trash is still here, it wasn't actually collected." },
    ];
    for (let i = 0; i < REOPENED_SPOTS.length; i++) {
        const spot = REOPENED_SPOTS[i];
        const createdAt = daysAgo(20 + i * 5);
        const resolvedAt = daysAgo(15 + i * 5);
        const reopenedAt = daysAgo(10 + i * 5);

        await seedReport({
            lat: spot.lat,
            lng: spot.lng,
            details: `Illegal dumping reported near ${spot.name} (reopened case).`,
            severity: i % 2 === 0 ? 'HIGH' : 'LOW',
            createdAt,
            resolvedAt,
            reopenNote: spot.reopenNote,
            reopenedAt,
        });
    }
}

main()
    .catch((err) => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
