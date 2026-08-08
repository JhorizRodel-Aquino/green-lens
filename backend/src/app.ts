import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import { ZodError } from 'zod';
import { MulterError } from 'multer';
import { UPLOAD_DIR, MAX_FILES } from './lib/uploads';
import usersRouter from './routes/users';
import reportsRouter from './routes/reports';
import authRouter from './routes/auth';

export const app = express();

app.use(cors());
app.use(express.json());

// Report photos are written to disk by the upload handler and served straight back.
app.use('/uploads', express.static(UPLOAD_DIR));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/reports', reportsRouter);

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof ZodError) {
        return void res.status(400).json({ error: 'Validation failed', issues: err.issues });
    }
    if (err instanceof MulterError) {
        const message =
            err.code === 'LIMIT_FILE_SIZE' ? 'Each photo must be 8MB or smaller'
            : err.code === 'LIMIT_FILE_COUNT' ? `At most ${MAX_FILES} photos per report`
            : err.message;
        return void res.status(400).json({ error: message });
    }
    if (err?.code === 'P2002') {
        return void res.status(409).json({ error: 'Email already in use' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
};
app.use(errorHandler);
