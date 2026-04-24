const Advert = require('../models/advert.model');
const Car = require('../models/car.model');

const buildImagesFromUpload = (req) => {
    if (Array.isArray(req.files) && req.files.length) {
        return req.files.map((f) => `/adverts/${f.filename}`);
    }
    if (req.file) return [`/adverts/${req.file.filename}`];
    return [];
};

// POST /api/adverts
exports.createAdvert = async(req, res) => {
    try {
        const {
            car,
            title,
            description,
            make,
            model,
            year,
            price,
            contactPhone,
            priority,
            priorityUntil,
            startsAt,
            expiresAt,
            status
        } = req.body;

        if (!title) return res.status(400).json({ success: false, message: 'title is required' });

        // If linked to a car, require ownership so people can't advertise
        // someone else's car.
        if (car) {
            const owned = await Car.findOne({ _id: car, owner: req.user._id });
            if (!owned) return res.status(400).json({ success: false, message: 'Car not found or not yours' });
        }

        const advert = new Advert({
            owner: req.user._id,
            car: car || null,
            title,
            description,
            make,
            model,
            year,
            price,
            contactPhone,
            priority: priority !== undefined ? Number(priority) : 0,
            priorityUntil: priorityUntil || null,
            startsAt: startsAt || Date.now(),
            expiresAt: expiresAt || null,
            status: status || 'active',
            images: buildImagesFromUpload(req),
        });

        await advert.save();
        res.status(201).json({ success: true, data: advert });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/adverts — list adverts ordered by *effective* priority then recency.
// Effective priority is the configured priority while still within
// priorityUntil; otherwise it is treated as 0, so expired boosts naturally
// drop back into the regular pool.
exports.listAdverts = async(req, res) => {
    try {
        const { page = 1, limit = 10, status = 'active' } = req.query;
        const now = new Date();

        const match = { status };
        // Hide adverts that have hit their expiry.
        match.$or = [{ expiresAt: null }, { expiresAt: { $gt: now } }];
        // And ones that haven't started yet.
        match.startsAt = { $lte: now };

        const pageNum = Math.max(1, Number(page));
        const limitNum = Math.max(1, Number(limit));

        const pipeline = [
            { $match: match },
            {
                $addFields: {
                    effectivePriority: {
                        $cond: [{
                                $and: [
                                    { $gt: ['$priority', 0] },
                                    { $ne: ['$priorityUntil', null] },
                                    { $gt: ['$priorityUntil', now] }
                                ]
                            },
                            '$priority',
                            0
                        ]
                    }
                }
            },
            { $sort: { effectivePriority: -1, createdAt: -1 } },
            { $skip: (pageNum - 1) * limitNum },
            { $limit: limitNum }
        ];

        const adverts = await Advert.aggregate(pipeline);
        await Advert.populate(adverts, [
            { path: 'owner', select: 'name phone' },
            { path: 'car' }
        ]);

        const total = await Advert.countDocuments(match);

        res.json({
            success: true,
            data: adverts,
            pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/adverts/featured — only adverts whose boost is currently active.
exports.getFeaturedAdverts = async(req, res) => {
    try {
        const { limit = 5 } = req.query;
        const now = new Date();

        const adverts = await Advert.find({
                status: 'active',
                priority: { $gt: 0 },
                priorityUntil: { $gt: now },
                startsAt: { $lte: now },
                $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }]
            })
            .populate('owner', 'name phone')
            .populate('car')
            .sort({ priority: -1, priorityUntil: 1, createdAt: -1 })
            .limit(Math.max(1, Number(limit)));

        res.json({ success: true, data: adverts });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/adverts/user/:userId
exports.getUserAdverts = async(req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const query = { owner: userId };

        const pageNum = Math.max(1, Number(page));
        const limitNum = Math.max(1, Number(limit));

        const adverts = await Advert.find(query)
            .populate('owner', 'name phone')
            .populate('car')
            .limit(limitNum)
            .skip((pageNum - 1) * limitNum)
            .sort({ createdAt: -1 });

        const total = await Advert.countDocuments(query);

        res.json({
            success: true,
            data: adverts,
            pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/adverts/:id — also bumps the views counter
exports.getAdvert = async(req, res) => {
    try {
        const advert = await Advert.findByIdAndUpdate(
                req.params.id, { $inc: { views: 1 } }, { new: true }
            )
            .populate('owner', 'name phone')
            .populate('car');

        if (!advert) return res.status(404).json({ success: false, message: 'Advert not found' });
        res.json({ success: true, data: advert });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// PUT /api/adverts/:id
exports.updateAdvert = async(req, res) => {
    try {
        const advert = await Advert.findOne({ _id: req.params.id, owner: req.user._id });
        if (!advert) return res.status(404).json({ success: false, message: 'Advert not yours or not found' });

        // Whitelist updatable fields so callers can't tamper with owner / views / clicks.
        const allowed = ['title', 'description', 'make', 'model', 'year', 'price',
            'contactPhone', 'priority', 'priorityUntil', 'startsAt',
            'expiresAt', 'status', 'car'
        ];
        for (const key of allowed) {
            if (req.body[key] !== undefined) advert[key] = req.body[key];
        }

        // If the caller links an advert to a car, re-verify ownership.
        if (req.body.car) {
            const owned = await Car.findOne({ _id: req.body.car, owner: req.user._id });
            if (!owned) return res.status(400).json({ success: false, message: 'Car not found or not yours' });
        }

        // Append any newly uploaded images to the existing list.
        const newImages = buildImagesFromUpload(req);
        if (newImages.length) advert.images.push(...newImages);

        await advert.save();
        res.json({ success: true, data: advert });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// DELETE /api/adverts/:id
exports.deleteAdvert = async(req, res) => {
    try {
        const advert = await Advert.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
        if (!advert) return res.status(404).json({ success: false, message: 'Advert not yours or not found' });
        res.json({ success: true, message: 'Advert deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/adverts/:id/priority
// Body: { priority: number, priorityUntil?: ISODate, durationDays?: number }
// Either priorityUntil or durationDays sets when the boost ends.
exports.setPriority = async(req, res) => {
    try {
        const { priority, priorityUntil, durationDays } = req.body;

        const advert = await Advert.findOne({ _id: req.params.id, owner: req.user._id });
        if (!advert) return res.status(404).json({ success: false, message: 'Advert not yours or not found' });

        if (priority !== undefined) advert.priority = Number(priority);

        if (priorityUntil) {
            advert.priorityUntil = new Date(priorityUntil);
        } else if (durationDays) {
            advert.priorityUntil = new Date(Date.now() + Number(durationDays) * 24 * 60 * 60 * 1000);
        }

        await advert.save();
        res.json({ success: true, data: advert });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/adverts/:id/click — analytics
exports.trackClick = async(req, res) => {
    try {
        const advert = await Advert.findByIdAndUpdate(
            req.params.id, { $inc: { clicks: 1 } }, { new: true }
        );
        if (!advert) return res.status(404).json({ success: false, message: 'Advert not found' });
        res.json({ success: true, data: { id: advert._id, clicks: advert.clicks } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
