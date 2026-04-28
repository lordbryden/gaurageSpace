const multer = require('multer');
const path = require('path');

// Storage engine: save to uploads/cars/
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/cars/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter: images (car photos / scanned ID cards) and PDFs (carte grise,
// sales certificate, customer docs).
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Only image or PDF files are allowed!'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB per file
        files: 12 // images (5) + 5 doc fields, plus headroom
    }
});

module.exports = upload;