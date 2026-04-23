const multer = require('multer');

const TIPOS_PERMITIDOS = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp',
  'application/pdf'
];

const uploadArchivo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (TIPOS_PERMITIDOS.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Use JPG, PNG, HEIC, WebP o PDF.'));
    }
  }
});

const uploadLogo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo imágenes JPG, PNG o WebP para el logo.'));
    }
  }
});

module.exports = { uploadArchivo, uploadLogo };
