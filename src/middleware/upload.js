const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const ApiError = require('../utils/ApiError');

const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
  'application/pdf': '.pdf',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const base = path
      .basename(file.originalname, path.extname(file.originalname))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'file';
    cb(null, `${base}-${crypto.randomBytes(6).toString('hex')}${MIME_EXT[file.mimetype]}`);
  },
});

const useBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

// Disk in development / on a VPS; memory when files are forwarded to Vercel Blob (serverless disks are read-only).
const upload = multer({
  storage: { _handleFile: (...a) => (useBlob() ? multer.memoryStorage() : storage)._handleFile(...a), _removeFile: (...a) => (useBlob() ? multer.memoryStorage() : storage)._removeFile(...a) },
  limits: { fileSize: 15 * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, cb) => {
    if (!MIME_EXT[file.mimetype]) return cb(ApiError.badRequest('Only JPG, PNG, WEBP, GIF, AVIF images or PDF files are allowed'));
    return cb(null, true);
  },
});

// After multer: push in-memory files to Vercel Blob and attach their public URL.
async function persistUploads(req, _res, next) {
  if (!useBlob()) return next();
  try {
    const put = module.exports.putBlob || require('@vercel/blob').put;
    const files = req.file ? [req.file] : req.files || [];
    for (const f of files) {
      const name = `${path.basename(f.originalname, path.extname(f.originalname)).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'file'}${MIME_EXT[f.mimetype]}`;
      // eslint-disable-next-line no-await-in-loop
      const blob = await put(`uploads/${name}`, f.buffer, { access: 'public', addRandomSuffix: true, contentType: f.mimetype });
      f.url = blob.url;
      f.filename = path.basename(blob.pathname);
      f.size = f.size || f.buffer.length;
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { upload, persistUploads, UPLOAD_DIR };
