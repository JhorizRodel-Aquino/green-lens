import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import { ZodError } from 'zod';
import { MulterError } from 'multer';
import usersRouter from './routes/users';
import reportsRouter from './routes/reports';
import authRouter from './routes/auth';
import uploadsRouter from './routes/uploads';
import { UPLOAD_DIR } from './lib/uploadDir';

export const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/uploads', uploadsRouter);

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof ZodError) {
        return void res.status(400).json({ error: 'Validation failed', issues: err.issues });
    }
    if (err instanceof MulterError) {
        return void res.status(400).json({ error: err.message });
    }
    if (err?.code === 'P2002') {
        return void res.status(409).json({ error: 'Email already in use' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
};
app.use(errorHandler);
