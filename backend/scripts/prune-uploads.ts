/**
 * Deletes files in UPLOAD_DIR that no ReportImage row points at — leftovers from
 * deleted reports or from re-running the sample-image import.
 *
 *   npx tsx scripts/prune-uploads.ts          # list what would go
 *   npx tsx scripts/prune-uploads.ts --delete
 */
import { readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../src/lib/prisma';
import { UPLOAD_DIR } from '../src/lib/uploads';

async function main() {
    const images = await prisma.reportImage.findMany({ select: { url: true } });
    const referenced = new Set(images.map((image) => path.basename(image.url)));

    const files = await readdir(UPLOAD_DIR).catch(() => [] as string[]);
    const orphans = files.filter((file) => !referenced.has(file));

    if (!process.argv.includes('--delete')) {
        console.log(`${orphans.length} orphaned of ${files.length} files. Re-run with --delete to remove them.`);
        return;
    }

    for (const orphan of orphans) await unlink(path.join(UPLOAD_DIR, orphan));
    console.log(`Deleted ${orphans.length} orphaned files, ${files.length - orphans.length} remain.`);
}

main()
    .catch((err) => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
