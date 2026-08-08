import path from 'path';
import fs from 'fs';

// Local disk storage for dev — swap for real object storage (S3/GCS/etc.) before production.
export const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
