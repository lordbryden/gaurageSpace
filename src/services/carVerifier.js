// Auto-verification of car images via the Hugging Face Inference API.
//
// Uses an *object-detection* model (facebook/detr-resnet-50) rather than an
// image classifier. Detection answers the right question — "is there a car
// in this image?" — and isn't tripped up by side-views, partial shots, or
// images where the car only fills part of the frame. Classification models
// like ViT split confidence across many vehicle subclasses and tend to
// underrate clear cars.
//
// We also check every uploaded image, not just the first — if any one of
// them shows a vehicle with confidence ≥ threshold, the car is verified.
//
// This is a temporary cloud-based check. The plan is to swap it out for a
// from-scratch local model later — runCarVerification is the only entry
// point the rest of the codebase touches, so the swap is one-file.

require('dotenv').config();

const fs = require('fs');
const path = require('path');

const Car = require('../models/car.model');

const MODEL = 'facebook/detr-resnet-50';
const ENDPOINT_PRIMARY = `https://router.huggingface.co/hf-inference/models/${MODEL}`;
const ENDPOINT_FALLBACK = `https://api-inference.huggingface.co/models/${MODEL}`;
// Detection can take longer than classification, especially on cold starts.
const REQUEST_TIMEOUT_MS = 60_000;

// COCO labels we count as a vehicle. DETR returns these exact strings.
const VEHICLE_LABELS = new Set(['car', 'truck', 'bus', 'motorcycle']);
// Detection score threshold. 0.5 is conservative — DETR puts real vehicles
// at 0.85+ in normal photos.
const DETECTION_THRESHOLD = 0.5;

const fetchWithTimeout = async(url, options, timeoutMs) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, {...options, signal: controller.signal });
    } catch (err) {
        if (err.name === 'AbortError') throw new Error(`request timed out after ${timeoutMs}ms`);
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

// Runs DETR on a single image. Returns the array of detections directly:
// [{ label, score, box: { xmin, ymin, xmax, ymax } }, ...]. Throws on any
// transport / API failure.
const detectObjects = async(imagePath) => {
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
            attempts.push(`${endpoint} → ${err.message}`);
            res = null;
            continue;
        }

        if (res.ok) break;

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

    const detections = await res.json();
    if (!Array.isArray(detections)) {
        throw new Error('unexpected HF response shape');
    }
    return detections;
};

// Verify across multiple images. Runs detection on every image so the caller
// can see exactly what each one looks like. Returns:
//   { isCar, confidence, reason, perImage: [{ index, isCar, label?, score?, topLabel?, topScore?, error? }] }
// A car is considered a car if *any* image had a vehicle ≥ threshold.
const verifyCarImages = async(imagePaths) => {
    const perImage = [];
    let errorCount = 0;

    for (let i = 0; i < imagePaths.length; i++) {
        const idx = i + 1;
        let detections;
        try {
            detections = await detectObjects(imagePaths[i]);
        } catch (err) {
            errorCount++;
            perImage.push({ index: idx, isCar: false, error: err.message });
            continue;
        }

        const vehicles = detections
            .filter((d) => VEHICLE_LABELS.has(d.label) && d.score >= DETECTION_THRESHOLD)
            .sort((a, b) => b.score - a.score);

        if (vehicles.length) {
            const best = vehicles[0];
            perImage.push({
                index: idx,
                isCar: true,
                label: best.label,
                score: best.score,
            });
        } else {
            const top = detections.slice().sort((a, b) => b.score - a.score)[0];
            perImage.push({
                index: idx,
                isCar: false,
                topLabel: top ? top.label : null,
                topScore: top ? top.score : 0,
            });
        }
    }

    if (errorCount === imagePaths.length) {
        const messages = perImage.map((r) => `image ${r.index}: ${r.error}`).join('; ');
        throw new Error(`detection failed for all images: ${messages}`);
    }

    // Strict: every image must show a vehicle. Any failure (non-vehicle
    // detection or API error) → not verified.
    const isCar = perImage.length > 0 && perImage.every((r) => r.isCar);
    const vehicleResults = perImage.filter((r) => r.isCar);
    const bestVehicle = vehicleResults.sort((a, b) => b.score - a.score)[0];

    let reason;
    if (isCar) {
        reason = `All ${imagePaths.length} images contained vehicles (best: ${bestVehicle.label} ${(bestVehicle.score * 100).toFixed(1)}%)`;
    } else {
        const failures = perImage
            .filter((r) => !r.isCar)
            .map((r) => {
                if (r.error) return `image ${r.index} errored (${r.error})`;
                if (r.topLabel) return `image ${r.index}: ${r.topLabel} ${(r.topScore * 100).toFixed(1)}%`;
                return `image ${r.index}: no detections`;
            })
            .join('; ');
        const failCount = imagePaths.length - vehicleResults.length;
        reason = `${failCount}/${imagePaths.length} image(s) not vehicles → ${failures}`;
    }

    return {
        isCar,
        confidence: bestVehicle ? bestVehicle.score : 0,
        reason,
        perImage,
    };
};

// Background entry point. Reads all of a car's images from disk, runs
// detection, and updates the car. Logs and swallows errors — verification
// failures must never break car creation.
const runCarVerification = async(carId) => {
    try {
        const car = await Car.findById(carId);
        if (!car) return;

        const images = Array.isArray(car.images) ? car.images : [];
        if (!images.length) {
            console.warn(`[verifier] car ${carId} has no image — skipping`);
            return;
        }

        // Stored as "/cars/<file>"; on disk it's uploads/cars/<file>.
        const onDisk = images
            .map((p) => path.join('uploads', String(p).replace(/^\//, '')))
            .filter((p) => fs.existsSync(p));

        if (!onDisk.length) {
            console.warn(`[verifier] car ${carId}: no image files found on disk`);
            return;
        }

        const result = await verifyCarImages(onDisk);

        // Per-image breakdown so you can trace which images contained
        // vehicles and which didn't.
        for (const r of result.perImage) {
            const tag = `[verifier] car ${carId} image ${r.index}/${onDisk.length}`;
            if (r.error) {
                console.warn(`${tag}: ERROR — ${r.error}`);
            } else if (r.isCar) {
                console.log(`${tag}: VEHICLE — ${r.label} (${(r.score * 100).toFixed(1)}%)`);
            } else {
                const top = r.topLabel ?
                    `${r.topLabel} ${(r.topScore * 100).toFixed(1)}%` :
                    'nothing detected';
                console.log(`${tag}: no vehicle (top object: ${top})`);
            }
        }

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

module.exports = { runCarVerification, detectObjects, verifyCarImages };
