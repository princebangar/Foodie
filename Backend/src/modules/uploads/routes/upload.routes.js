import crypto from 'crypto';
import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { upload } from '../../../middleware/upload.js';
import { config } from '../../../config/env.js';
import {
    storeImageBuffer,
    storeFileBuffer,
    deleteStoredAsset,
    usesRemoteStore
} from '../../../services/storage.service.js';

const router = express.Router();

/**
 * /internal is what a local/dev backend with UPLOAD_REMOTE_ORIGIN calls, so its
 * uploads land on this server's disk. Guarded by UPLOAD_INTERNAL_SECRET; while
 * that is unset here the endpoint answers 404.
 */
const requireInternalSecret = (req, res, next) => {
    const expected = Buffer.from(config.uploadInternalSecret);
    const provided = Buffer.from(String(req.get('X-Upload-Secret') || '').trim());
    if (!expected.length || usesRemoteStore()) {
        return res.status(404).json({ success: false, message: 'Not found' });
    }
    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
        return res.status(401).json({ success: false, message: 'Unauthorized upload' });
    }
    return next();
};

// The calling backend already checked the file type with the normal upload middleware.
const internalUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: Number(process.env.MAX_UPLOAD_SIZE_MB || 25) * 1024 * 1024, files: 1 }
});

// POST /v1/uploads/internal — body: file, kind ('image' | 'file'), folder, maxWidth?
router.post('/internal', requireInternalSecret, internalUpload.single('file'), async (req, res, next) => {
    try {
        if (!req.file?.buffer?.length) {
            return res.status(400).json({ success: false, message: 'No file provided' });
        }
        const folder = String(req.body?.folder || '').trim() || 'uploads';
        const maxWidth = Number(req.body?.maxWidth) || undefined;
        const stored = req.body?.kind === 'file'
            ? await storeFileBuffer(req.file.buffer, folder, req.file.originalname)
            : await storeImageBuffer(req.file.buffer, folder, { maxWidth });
        return res.status(200).json({ success: true, data: stored });
    } catch (error) {
        next(error);
    }
});

// DELETE /v1/uploads/internal — body: { url } (URL, filename or legacy public id)
router.delete('/internal', requireInternalSecret, async (req, res, next) => {
    try {
        const url = String(req.body?.url || '').trim();
        if (!url) {
            return res.status(400).json({ success: false, message: 'url is required' });
        }
        const deleted = await deleteStoredAsset(url);
        return res.status(200).json({ success: true, data: { deleted } });
    } catch (error) {
        next(error);
    }
});

/**
 * Average the top 10px strip — the app uses it as the status-bar theme colour
 * behind a banner, so only the very top of the image matters.
 */
const extractDominantColor = async (buffer) => {
    try {
        const { data, info } = await sharp(buffer)
            .resize({ width: 100, height: 10, fit: 'cover', position: 'top' })
            .raw()
            .toBuffer({ resolveWithObject: true });
        let r = 0, g = 0, b = 0;
        const pixels = info.width * info.height;
        for (let i = 0; i < data.length; i += info.channels) {
            r += data[i]; g += data[i + 1]; b += data[i + 2];
        }
        return '#' + [r, g, b]
            .map((sum) => Math.round(sum / pixels).toString(16).padStart(2, '0'))
            .join('');
    } catch {
        return '#D91F3A';
    }
};

// POST /v1/uploads/image
router.post('/image', upload.single('file'), async (req, res, next) => {
    try {
        if (!req.file || !req.file.buffer) {
            return res.status(400).json({
                success: false,
                message: 'No file provided'
            });
        }

        const folder = typeof req.body?.folder === 'string' && req.body.folder.trim()
            ? req.body.folder.trim()
            : 'uploads';

        const [stored, dominantColor] = await Promise.all([
            storeImageBuffer(req.file.buffer, folder),
            extractDominantColor(req.file.buffer)
        ]);

        return res.status(200).json({
            success: true,
            message: 'Image uploaded successfully',
            data: {
                url: stored.secure_url,
                dominantColor,
                publicId: stored.public_id
            }
        });
    } catch (error) {
        next(error);
    }
});

// POST /v1/uploads/video
router.post('/video', upload.single('file'), async (req, res, next) => {
    try {
        if (!req.file || !req.file.buffer) {
            return res.status(400).json({
                success: false,
                message: 'No file provided'
            });
        }

        const mimeType = String(req.file.mimetype || '').toLowerCase();
        if (!mimeType.startsWith('video/')) {
            return res.status(400).json({
                success: false,
                message: 'Only video files are allowed'
            });
        }

        const folder = typeof req.body?.folder === 'string' && req.body.folder.trim()
            ? req.body.folder.trim()
            : 'uploads/videos';

        const stored = await storeFileBuffer(
            req.file.buffer,
            folder,
            req.file.originalname || 'video.mp4'
        );

        return res.status(200).json({
            success: true,
            message: 'Video uploaded successfully',
            data: {
                url: stored.secure_url,
                publicId: stored.public_id
            }
        });
    } catch (error) {
        next(error);
    }
});

export default router;
