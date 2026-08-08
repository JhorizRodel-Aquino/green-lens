import { Router } from 'express';
import { uploadImages, saveImages } from '../lib/uploads';

const router = Router();

// Standalone upload endpoint — for flows that need hosted URLs ahead of time (e.g. reopen
// proof photos). Report creation itself scores+saves photos inline, see routes/reports.ts.
router.post('/', uploadImages, async (req, res, next) => {
    try {
        const files = (req.files as Express.Multer.File[]) ?? [];
        const urls = await saveImages(files);
        res.status(201).json({ urls });
    } catch (err) {
        next(err);
    }
});

export default router;
