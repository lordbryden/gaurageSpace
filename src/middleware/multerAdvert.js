const multer = require('multer');
const path = require('path');
const fs = require('fs');

const DEST = 'uploads/adverts/';
fs.mkdirSync(DEST, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, DEST),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed!'), false);
};

module.exports = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 5
    }
});
