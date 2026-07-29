import bcrypt from 'bcrypt';
import { prisma } from '../src/lib/prisma';

async function main() {
    const email = process.env.SEED_SUPER_ADMIN_EMAIL ?? 'superadmin@greenlens.local';
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        console.log(`SUPER_ADMIN already exists: ${email}`);
        return;
    }

    const password = process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'change-me-immediately';
    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.create({
        data: {
            name: 'Super Admin', email, passwordHash,
            role: 'SUPER_ADMIN', status: 'ACTIVE',
        },
    });

    console.log(`Seeded SUPER_ADMIN: ${email} / ${password}`);
}

main()
    .catch((err) => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
