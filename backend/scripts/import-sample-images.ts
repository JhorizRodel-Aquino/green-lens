/**
 * Replaces the seeded placehold.co image URLs with real trash photos, so the demo
 * looks like the real thing (and so the map/detail views show what the model scores).
 *
 * Copies images from a source folder into UPLOAD_DIR and repoints every ReportImage
 * row at the copy. Images are assigned round-robin, so the source folder can hold
 * fewer photos than there are report images.
 *
 *   npx tsx scripts/import-sample-images.ts <source-folder>
 *   npx tsx scripts/import-sample-images.ts <source-folder> --score
 *   npx tsx scripts/import-sample-images.ts --score-only
 *
 * --score also re-runs each report's photos through the severity scorer (ml/score.py
 * must be running) so the stored severity matches the picture now attached to it.
 * --score-only skips the copying and just rescores what is already attached — what you
 * want after changing the thresholds in ml/score.py.
 */
import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../src/lib/prisma';
import { UPLOAD_DIR } from '../src/lib/uploads';
import { scoreSeverity } from '../src/services/severity';

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL ?? 'http://localhost:4000';
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

async function main() {
    const scoreOnly = process.argv.includes('--score-only');
    const rescore = scoreOnly || process.argv.includes('--score');
    const sourceDir = process.argv[2];

    if (!scoreOnly && !sourceDir) {
        console.error('Usage: npx tsx scripts/import-sample-images.ts <source-folder> [--score] | --score-only');
        process.exitCode = 1;
        return;
    }

    if (!scoreOnly) await copyImages(sourceDir);
    if (rescore) await rescoreReports();
    else console.log('Skipped severity rescoring (pass --score to re-run the model).');
}

async function copyImages(sourceDir: string) {
    const sources = (await readdir(sourceDir))
        .filter((name) => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()))
        .sort();
    if (sources.length === 0) {
        console.error(`No images found in ${sourceDir}`);
        process.exitCode = 1;
        return;
    }

    await mkdir(UPLOAD_DIR, { recursive: true });

    const images = await prisma.reportImage.findMany({ orderBy: { createdAt: 'asc' } });
    console.log(`${sources.length} source images -> ${images.length} report images`);

    for (const [i, image] of images.entries()) {
        const source = sources[i % sources.length];
        const name = randomUUID() + path.extname(source).toLowerCase();
        await copyFile(path.join(sourceDir, source), path.join(UPLOAD_DIR, name));
        await prisma.reportImage.update({
            where: { id: image.id },
            data: { url: `${PUBLIC_BASE_URL}/uploads/${name}` },
        });
    }
    console.log(`Copied ${images.length} images into ${UPLOAD_DIR}`);
}

async function rescoreReports() {
    // Severity follows the photo now attached, not the value the seed made up.
    const reports = await prisma.report.findMany({
        where: { images: { some: { kind: 'USER_UPLOAD' } } },
        include: { images: { where: { kind: 'USER_UPLOAD' } } },
    });

    for (const report of reports) {
        const buffers = await Promise.all(
            report.images.map((image) => readFile(path.join(UPLOAD_DIR, path.basename(image.url)))),
        );
        const severity = await scoreSeverity(buffers.map((b) => b.toString('base64')));
        // 'NONE' means the model saw no trash — the seed's own value is no better, so leave it.
        if (severity === null || severity === 'NONE') {
            console.log(`${report.id}: kept ${report.severity} (scorer said ${severity})`);
            continue;
        }
        await prisma.report.update({ where: { id: report.id }, data: { severity } });
        console.log(`${report.id}: ${report.severity} -> ${severity}`);
    }
}

main()
    .catch((err) => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
