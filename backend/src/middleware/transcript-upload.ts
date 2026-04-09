import type { Request } from 'express';
import multer from 'multer';

const storage = multer.memoryStorage();

function allowedTranscriptFile(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
    const name = file.originalname || '';
    const byExt = /\.(txt|md|srt|vtt)$/i.test(name);
    const mimeOk =
        /^text\//i.test(file.mimetype) ||
        file.mimetype === 'application/octet-stream' ||
        file.mimetype === 'application/x-subrip';
    if (byExt || mimeOk) {
        cb(null, true);
        return;
    }
    cb(new Error('Solo archivos de texto (.txt, .md, .srt, .vtt)'));
}

export const transcriptFileUpload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: allowedTranscriptFile,
});
