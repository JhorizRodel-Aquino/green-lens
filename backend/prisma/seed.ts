import bcrypt from 'bcrypt';
import { prisma } from '../src/lib/prisma';

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
}

main()
    .catch((err) => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
