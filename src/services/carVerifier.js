// Auto-verification of car images via the Hugging Face Inference API.
// Free to use with an HF account (set HF_TOKEN in .env). The endpoint runs
// google/vit-base-patch16-224 — a 1000-class ImageNet classifier that
// includes plenty of vehicle classes (sports car, pickup, school bus, etc.).
//
// This is a temporary cloud-based check. The plan is to swap it out for a
// from-scratch local model later — runCarVerification is the only entry
// point the rest of the codebase touches, so the swap is one-file.

// Defensive: server.js already calls dotenv at startup, but if this module
// happens to be loaded standalone (e.g. a worker, test, one-off script) we
// still want HF_TOKEN populated. dotenv is idempotent — a second call is
// a no-op when the var is already set.
require('dotenv').config();

const fs = require('fs');
const path = require('path');

const Car = require('../models/car.model');

const MODEL = 'google/vit-base-patch16-224';
// HF migrated their Inference API to a "router" URL under the
// Inference Providers system. The old api-inference.huggingface.co
// path now 404s for most models. Falling back to the legacy URL on
// failure keeps this resilient if HF rolls things back.
const ENDPOINT_PRIMARY = `https://router.huggingface.co/hf-inference/models/${MODEL}`;
const ENDPOINT_FALLBACK = `https://api-inference.huggingface.co/models/${MODEL}`;
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

// Node 18's fetch hides the real network error inside err.cause. This wrapper
// surfaces it so logs say "ENOTFOUND router.huggingface.co" rather than the
// useless "fetch failed".
const fetchWithTimeout = async(url, options, timeoutMs) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, {...options, signal: controller.signal });
    } catch (err) {
        if (err.name === 'AbortError') {
            throw new Error(`request timed out after ${timeoutMs}ms`);
        }
        const cause = err.cause;
        const detail = cause ?
            [cause.code, cause.message].filter(Boolean).join(' ').trim() :
            err.message;
        throw new Error(`network error: ${detail || err.message}`);
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
        throw new Error('HF_TOKEN env var not set (did you restart the server after editing .env?)');
    }

    const buf = await fs.promises.readFile(imagePath);
    const headers = {
        Authorization: `Bearer ${process.env.HF_TOKEN}`,
        'Content-Type': guessContentType(imagePath),
    };

    let res;
    const attempts = [];
    for (const endpoint of [ENDPOINT_PRIMARY, ENDPOINT_FALLBACK]) {
        try {
            res = await fetchWithTimeout(endpoint, {
                method: 'POST',
                headers,
                body: buf,
            }, REQUEST_TIMEOUT_MS);
        } catch (err) {
            // Network-layer failure (DNS, TLS, connection reset, timeout).
            // Try the next URL instead of giving up.
            attempts.push(`${endpoint} → ${err.message}`);
            res = null;
            continue;
        }

        if (res.ok) break;

        // Auth / rate-limit / 5xx are real API failures — don't waste a
        // second call on them.
        if (res.status !== 404 && res.status !== 410) {
            const text = await res.text().catch(() => '');
            throw new Error(`HF API ${res.status}: ${text.slice(0, 200)}`);
        }
        const text = await res.text().catch(() => '');
        attempts.push(`${endpoint} → HTTP ${res.status} ${text.slice(0, 80)}`);
    }

    if (!res || !res.ok) {
        throw new Error(`all HF endpoints failed: ${attempts.join('; ')}`);
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
