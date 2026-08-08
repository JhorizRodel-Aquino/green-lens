import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import type { Request } from 'express';
import { UPLOAD_DIR } from './uploadDir';

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, `${crypto.randomUUID()}${ext}`);
    },
});

// Shared by any route that accepts photo uploads (report creation, standalone /api/uploads).
export const imageUpload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024, files: 5 },
    fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

export function fileUrl(req: Request, filename: string): string {
    return `${req.protocol}://${req.get('host')}/uploads/${filename}`;
}
