// Post-multer middleware: converts every uploaded image to WebP at quality
// 80, resizes huge originals down to a sensible max, and replaces the
// original file on disk. Multer's file object is mutated in place so the
// downstream controller sees the .webp filename without needing to know
// processing happened.
//
// Works with all three multer shapes — multer.single (req.file),
// multer.array (req.files: File[]), multer.fields (req.files: {field:
// File[]}).
//
// Sharp ships prebuilt binaries but isn't installed by default. If the
// require fails, we log once and pass the original files through
// untouched so the server keeps working.

const fs = require('fs/promises');
const path = require('path');

let sharp;
let sharpWarned = false;
try {
    sharp = require('sharp');
} catch (err) {
    if (!sharpWarned) {
        console.warn('[processImages] sharp not installed — uploads will not be converted to WebP. Run `npm install sharp` to enable.');
        sharpWarned = true;
    }
}

const MAX_DIMENSION = 1600;
const QUALITY = 80;

const processOne = async(file) => {
    if (!sharp) return; // graceful no-op
    if (!file || !file.mimetype || !file.mimetype.startsWith('image/')) return;
    // Already WebP (e.g. an already-processed re-upload)? Skip.
    if (file.mimetype === 'image/webp' && path.extname(file.filename).toLowerCase() === '.webp') return;

    const inputPath = file.path;
    const dir = path.dirname(inputPath);
    const baseName = path.basename(inputPath, path.extname(inputPath));
    const newFilename = `${baseName}.webp`;
    const outputPath = path.join(dir, newFilename);

    try {
        await sharp(inputPath)
            // Honor EXIF orientation so phone uploads aren't sideways.
            .rotate()
            .resize({
                width: MAX_DIMENSION,
                height: MAX_DIMENSION,
                fit: 'inside',
                withoutEnlargement: true,
            })
            .webp({ quality: QUALITY })
            .toFile(outputPath);

        // Remove the original (a different filename now that the extension changed).
        await fs.unlink(inputPath).catch(() => {});

        // Mutate the multer file object so controllers see the WebP filename.
        file.filename = newFilename;
        file.path = outputPath;
        file.mimetype = 'image/webp';
    } catch (err) {
        console.warn(`[processImages] failed to convert ${inputPath}: ${err.message}`);
    }
};

module.exports = async(req, res, next) => {
    try {
        if (req.file) await processOne(req.file);

        if (Array.isArray(req.files)) {
            await Promise.all(req.files.map(processOne));
        } else if (req.files && typeof req.files === 'object') {
            // multer.fields shape — { fieldname: File[] }
            const allFiles = [];
            for (const key of Object.keys(req.files)) {
                if (Array.isArray(req.files[key])) allFiles.push(...req.files[key]);
            }
            await Promise.all(allFiles.map(processOne));
        }

        next();
    } catch (err) {
        next(err);
    }
};
