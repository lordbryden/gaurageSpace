// Auto-verification of car images via the Hugging Face Inference API.
// Free to use with an HF account (set HF_TOKEN in .env). The endpoint runs
// google/vit-base-patch16-224 — a 1000-class ImageNet classifier that
// includes plenty of vehicle classes (sports car, pickup, school bus, etc.).
//
// This is a temporary cloud-based check. The plan is to swap it out for a
// from-scratch local model later — runCarVerification is the only entry
// point the rest of the codebase touches, so the swap is one-file.

const fs = require('fs');
const path = require('path');

const Car = require('../models/car.model');

const MODEL = 'google/vit-base-patch16-224';
const ENDPOINT = `https://api-inference.huggingface.co/models/${MODEL}`;
const REQUEST_TIMEOUT_MS = 30_000;
const VEHICLE_CONFIDENCE_THRESHOLD = 0.3;

// ImageNet labels are messy ("sports car, sport car"), so we look for any
// of these substrings inside the predicted label rather than enumerating the
// 1000 classes by hand. Covers cars, trucks, buses, vans, motorcycles, etc.
const VEHICLE_KEYWORDS = [
    'car', 'truck', 'bus', 'van', 'jeep', 'limo', 'taxi', 'cab',
    'pickup', 'wagon', 'convertible', 'racer', 'minibus', 'minivan',
    'ambulance', 'fire engine', 'tow truck', 'trolleybus', 'streetcar',
    'moped', 'motor scooter', 'motorcycle',
];

const looksLikeVehicle = (label) => {
    const l = String(label).toLowerCase();
    return VEHICLE_KEYWORDS.some((kw) => l.includes(kw));
};

const fetchWithTimeout = async(url, options, timeoutMs) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, {...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
};

const guessContentType = (filePath) => {
    const ext = path.extname(filePath).slice(1).toLowerCase();
    if (!ext) return 'application/octet-stream';
    if (ext === 'jpg') return 'image/jpeg';
    return `image/${ext}`;
};

// Calls the HF API and returns { isCar, confidence, reason }.
// Throws on transport / API errors so the caller can decide what to do.
const verifyCarImage = async(imagePath) => {
    if (!process.env.HF_TOKEN) {
        throw new Error('HF_TOKEN env var not set');
    }

    const buf = await fs.promises.readFile(imagePath);
    const headers = {
        Authorization: `Bearer ${process.env.HF_TOKEN}`,
        'Content-Type': guessContentType(imagePath),
    };

    const res = await fetchWithTimeout(ENDPOINT, {
        method: 'POST',
        headers,
        body: buf,
    }, REQUEST_TIMEOUT_MS);

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HF API ${res.status}: ${text.slice(0, 200)}`);
    }

    const predictions = await res.json();
    if (!Array.isArray(predictions) || !predictions.length) {
        throw new Error('Unexpected HF response shape');
    }

    const top = predictions[0];
    const topVehicle = predictions.find((p) => looksLikeVehicle(p.label));

    if (topVehicle && topVehicle.score >= VEHICLE_CONFIDENCE_THRESHOLD) {
        return {
            isCar: true,
            confidence: topVehicle.score,
            reason: `Detected "${topVehicle.label}" (${(topVehicle.score * 100).toFixed(1)}%)`,
        };
    }

    return {
        isCar: false,
        confidence: top ? top.score : 0,
        reason: top ?
            `Top guess "${top.label}" (${(top.score * 100).toFixed(1)}%) doesn't look like a vehicle` :
            'No predictions returned',
    };
};

// Background entry point. Reads the car's first image from disk, runs the
// classifier, and updates the car. Logs and swallows errors — verification
// failures must never break car creation.
const runCarVerification = async(carId) => {
    try {
        const car = await Car.findById(carId);
        if (!car) return;

        const firstImage = Array.isArray(car.images) && car.images[0];
        if (!firstImage) {
            console.warn(`[verifier] car ${carId} has no image — skipping`);
            return;
        }

        // Stored as "/cars/<file>"; on disk it's uploads/cars/<file>.
        const onDisk = path.join('uploads', String(firstImage).replace(/^\//, ''));
        if (!fs.existsSync(onDisk)) {
            console.warn(`[verifier] car ${carId} image missing on disk: ${onDisk}`);
            return;
        }

        const result = await verifyCarImage(onDisk);

        const update = {
            verificationCheckedAt: new Date(),
            verificationReason: result.reason,
        };
        if (result.isCar) {
            update.verified = 'verified';
            update.flagged = false;
        } else {
            update.flagged = true;
        }
        await Car.findByIdAndUpdate(carId, update);

        console.log(`[verifier] car ${carId}: ${result.isCar ? 'VERIFIED' : 'FLAGGED'} — ${result.reason}`);
    } catch (err) {
        console.warn(`[verifier] car ${carId} failed: ${err.message}`);
    }
};

module.exports = { runCarVerification, verifyCarImage };
