import { Router } from 'express';
import { imageUpload, fileUrl } from '../lib/imageUpload';

const router = Router();

// Standalone upload endpoint — for flows that need hosted URLs ahead of time (e.g. reopen
// proof photos). Report creation itself now accepts photos directly, see routes/reports.ts.
router.post('/', imageUpload.array('images', 5), (req, res) => {
    const files = (req.files as Express.Multer.File[]) ?? [];
    const urls = files.map((file) => fileUrl(req, file.filename));
    res.status(201).json({ urls });
});

export default router;
