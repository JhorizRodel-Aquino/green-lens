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

async function seedReport(data: {
    lat: number; lng: number; details: string;
    severity?: 'HIGH' | 'LOW'; imageUrls?: string[];
}) {
    const existing = await prisma.report.findFirst({ where: { lat: data.lat, lng: data.lng } });
    if (existing) {
        console.log(`Already exists: report at ${data.lat},${data.lng}`);
        return;
    }

    try {
        const jurisdiction = await resolveJurisdiction(data.lat, data.lng);
        const imageUrls = data.imageUrls ?? ['https://placehold.co/600x400?text=Report'];
        const report = await prisma.report.create({
            data: {
                lat: data.lat, lng: data.lng, details: data.details,
                severity: data.severity, images: { create: imageUrls.map((url) => ({ url })) },
                ...jurisdiction,
            },
        });
        console.log(`Seeded report ${report.id}: ${jurisdiction.locationLabel} (${jurisdiction.jurisdictionStatus})`);
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
    await seedReport({ lat: 14.3167, lng: 120.7667, details: 'Open dumping near the public market.', severity: 'HIGH' });
    await seedReport({ lat: 14.339, lng: 120.762, details: 'Uncollected trash pile along the barangay road.', severity: 'LOW' });
    await seedReport({ lat: 14.1153, lng: 120.9622, details: 'Illegal dumping near the roadside in Tagaytay.', severity: 'LOW' });
    await seedReport({ lat: 14.5995, lng: 120.9842, details: 'Garbage overflow at a Manila street corner.', severity: 'HIGH' });
    await seedReport({ lat: 10.3157, lng: 123.8854, details: 'Scattered waste near a Cebu City intersection.', severity: 'LOW' });
}

main()
    .catch((err) => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
