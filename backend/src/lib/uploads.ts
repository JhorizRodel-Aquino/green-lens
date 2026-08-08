import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
// Absolute so the URL works from the phone/browser, which is not on the API's origin.
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL ?? 'http://localhost:4000';

export const MAX_FILES = 5;
const MAX_BYTES = 8 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
};

// Memory, not disk: the photos are scored by the model before anything is written, so a
// report rejected for "no trash detected" leaves no orphan files behind to clean up.
export const uploadImages = multer({
    storage: multer.memoryStorage(),
    limits: { files: MAX_FILES, fileSize: MAX_BYTES },
    fileFilter: (_req, file, cb) => {
        if (!(file.mimetype in EXTENSIONS)) {
            // A MulterError (not a bare Error) so the app's handler answers 400, not 500.
            const err = new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname);
            err.message = `Unsupported image type: ${file.mimetype}. Use JPEG, PNG, or WebP.`;
            cb(err);
            return;
        }
        cb(null, true);
    },
}).array('images', MAX_FILES);

/** Writes the uploaded buffers to UPLOAD_DIR and returns their public URLs. */
export async function saveImages(files: Express.Multer.File[]): Promise<string[]> {
    await mkdir(UPLOAD_DIR, { recursive: true });

    return Promise.all(
        files.map(async (file) => {
            // Random name — the client-supplied filename is untrusted and could traverse paths.
            const name = randomUUID() + EXTENSIONS[file.mimetype];
            await writeFile(path.join(UPLOAD_DIR, name), file.buffer);
            return `${PUBLIC_BASE_URL}/uploads/${name}`;
        }),
    );
}
