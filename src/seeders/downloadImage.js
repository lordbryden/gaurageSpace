const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const slug = (s) =>
    String(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

const FETCH_TIMEOUT_MS = 20_000;
const MIN_IMAGE_BYTES = 1024;

const fetchWithTimeout = async(url, timeoutMs = FETCH_TIMEOUT_MS) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, {
            redirect: "follow",
            signal: controller.signal,
            // Browser-shaped UA — loremflickr (and some CDNs behind it) reject
            // non-browser UAs with silent failures even though curl gets 200s.
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                Accept: "image/*,*/*;q=0.8",
            },
        });
    } finally {
        clearTimeout(timer);
    }
};

const tryDownload = async(url, targetPath) => {
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
        throw new Error(`unexpected content-type "${contentType}"`);
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < MIN_IMAGE_BYTES) {
        throw new Error(`response too small (${buf.length} bytes)`);
    }

    await fsp.writeFile(targetPath, buf);
    return buf.length;
};

// Resolves an image for a seeded record. Priority:
//   1. Cached file already on disk (from a previous run)
//   2. User-provided file in localAssetsDir (matched by index or make_model slug)
//   3. Download from loremflickr (make/model keyword)
//   4. Download from picsum.photos using a deterministic seed — always works,
//      just not car-specific
// Returns the public path (e.g. "/cars/seed_0_toyota_corolla.jpg") or null
// if every source failed. Never throws.
exports.resolveSeedImage = async({
    idx,
    make,
    model,
    uploadsDir,
    localAssetsDir,
    filenamePrefix,
    publicPrefix,
}) => {
    const name = `${filenamePrefix}_${idx}_${slug(make)}_${slug(model)}.jpg`;
    const targetPath = path.join(uploadsDir, name);
    const publicPath = `${publicPrefix}/${name}`;

    if (fs.existsSync(targetPath)) {
        console.log(`  [${idx}] cached: ${name}`);
        return publicPath;
    }

    // Local override
    if (fs.existsSync(localAssetsDir)) {
        const files = await fsp.readdir(localAssetsDir);
        const match = files.find((f) => {
            const base = path.parse(f).name.toLowerCase();
            return (
                base === String(idx) ||
                base === `${slug(make)}_${slug(model)}` ||
                base === `${idx}_${slug(make)}_${slug(model)}`
            );
        });
        if (match) {
            await fsp.copyFile(path.join(localAssetsDir, match), targetPath);
            console.log(`  [${idx}] local asset → ${match}`);
            return publicPath;
        }
    }

    console.log(`  [${idx}] fetching ${make} ${model}...`);

    const sources = [{
            label: "loremflickr",
            url: `https://loremflickr.com/800/500/${encodeURIComponent(`${make},${model},car`)}`,
        },
        {
            label: "picsum",
            url: `https://picsum.photos/seed/${encodeURIComponent(`${slug(make)}-${slug(model)}-${idx}`)}/800/500`,
        },
    ];

    for (const src of sources) {
        try {
            const bytes = await tryDownload(src.url, targetPath);
            console.log(`    ✓ ${src.label} (${(bytes / 1024).toFixed(1)} KB)`);
            return publicPath;
        } catch (err) {
            console.warn(`    ✗ ${src.label}: ${err.message}`);
        }
    }

    console.warn(`  [${idx}] all sources failed — advert/car will have no image`);
    return null;
};

exports.slug = slug;
