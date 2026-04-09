import type { Request } from 'express';
import multer from 'multer';

const storage = multer.memoryStorage();

const MAX_CONTEXT = 25;
const MAX_SCREENSHOTS = 3;
const MAX_SIZE = 20 * 1024 * 1024;

function understandingFileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
    const name = (file.originalname || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    const okMime =
        mime === 'application/pdf' ||
        mime === 'application/msword' ||
        mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mime.startsWith('text/') ||
        mime === 'application/json' ||
        mime === 'application/octet-stream' ||
        mime.startsWith('image/');
    const okExt = /\.(pdf|doc|docx|txt|md|markdown|json|png|jpe?g|webp|gif)$/i.test(name);
    if (okMime || okExt) {
        cb(null, true);
        return;
    }
    cb(new Error('Tipo de archivo no permitido para contexto o capturas.'));
}

export const understandingUpload = multer({
    storage,
    limits: { fileSize: MAX_SIZE },
    fileFilter: understandingFileFilter,
});

export const understandingUploadFields = understandingUpload.fields([
    { name: 'contextFiles', maxCount: MAX_CONTEXT },
    { name: 'screenshots', maxCount: MAX_SCREENSHOTS },
]);
