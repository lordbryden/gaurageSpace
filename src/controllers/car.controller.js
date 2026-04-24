const Car = require('../models/car.model');
const User = require('../models/user.model');

// Escape user-supplied strings before dropping them into a regex so odd
// characters (like "(", ".", etc.) can't break the query or trigger ReDoS.
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Builds the shared make/model/year/price/q filter applied by the three list
// endpoints. Returns {} when no filter params are present.
const buildCarFilter = (q) => {
    const filter = {};

    if (q.make) filter.make = { $regex: escapeRegex(q.make), $options: 'i' };
    if (q.model) filter.model = { $regex: escapeRegex(q.model), $options: 'i' };

    if (q.year) {
        filter.year = Number(q.year);
    } else if (q.yearMin || q.yearMax) {
        filter.year = {};
        if (q.yearMin) filter.year.$gte = Number(q.yearMin);
        if (q.yearMax) filter.year.$lte = Number(q.yearMax);
    }

    if (q.priceMin || q.priceMax) {
        filter.price = {};
        if (q.priceMin) filter.price.$gte = Number(q.priceMin);
        if (q.priceMax) filter.price.$lte = Number(q.priceMax);
    }

    if (q.q) {
        const re = { $regex: escapeRegex(q.q), $options: 'i' };
        filter.$or = [{ make: re }, { model: re }, { description: re }];
    }

    return filter;
};

// POST /api/cars - Create new car (for sale, rent, garage)
exports.createCar = async(req, res) => {
    try {
        const { make, model, year, vin, description, price, rentalPrice, status = 'available', inGarage = false, forSale = false, forRent = false } = req.body;
        const owner = req.user._id;

        const existingCar = await Car.findOne({ vin, owner });
        if (existingCar) {
            return res.status(400).json({ success: false, message: 'Car with VIN already exists' });
        }

        const car = new Car({
            owner,
            make,
            model,
            year,
            vin,
            description,
            price,
            rentalPrice,
            status,
            inGarage,
            forSale,
            forRent,
            images: Array.isArray(req.files) ? req.files.map(file => `/cars/${file.filename}`) : (req.file ? [`/cars/${req.file.filename}`] : [])
        });

        await car.save();
        await User.findByIdAndUpdate(owner, { $addToSet: { cars: car._id } });

        res.status(201).json({ success: true, data: car });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/cars/park - Legacy garage park
exports.parkCar = async(req, res) => {
    try {
        const { make, model, year, vin, description, price } = req.body;
        const owner = req.user._id;

        let car = await Car.findOne({ vin, owner });
        if (car) {
            car.status = 'parked';
            car.inGarage = true;
        } else {
            car = new Car({
                owner,
                make,
                model,
                year,
                vin,
                description,
                price,
                status: 'parked',
                inGarage: true,
                images: Array.isArray(req.files) ? req.files.map(file => `/cars/${file.filename}`) : (req.file ? [`/cars/${req.file.filename}`] : [])
            });
        }

        await car.save();
        await User.findByIdAndUpdate(owner, { $addToSet: { cars: car._id } });

        res.status(201).json({ success: true, data: car });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/cars/collect/:id
exports.collectCar = async(req, res) => {
    try {
        const car = await Car.findOne({ _id: req.params.id, owner: req.user._id });
        if (!car) return res.status(404).json({ success: false, message: 'Car not yours' });

        car.status = 'available';
        car.inGarage = false;
        await car.save();

        res.json({ success: true, data: car });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/cars/buy/:id
exports.buyCar = async(req, res) => {
    try {
        const car = await Car.findOne({ _id: req.params.id, status: 'available', forSale: true });
        if (!car) return res.status(404).json({ success: false, message: 'Car not available for sale' });

        car.owner = req.user._id;
        car.forSale = false;
        await car.save();
        await User.findByIdAndUpdate(req.user._id, { $addToSet: { cars: car._id } });

        res.json({ success: true, data: car });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/cars/sell/:id
exports.sellCar = async(req, res) => {
    try {
        const { price } = req.body;
        const car = await Car.findOne({ _id: req.params.id, owner: req.user._id });
        if (!car) return res.status(404).json({ success: false, message: 'Car not yours' });

        car.forSale = true;
        if (price) car.price = price;
        await car.save();

        res.json({ success: true, data: car });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/cars/rent/:id
exports.rentCar = async(req, res) => {
    try {
        const car = await Car.findOne({ _id: req.params.id, status: 'available', forRent: true });
        if (!car) return res.status(404).json({ success: false, message: 'Car not available for rent' });

        car.status = 'rented';
        await car.save();

        res.json({ success: true, data: car });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/cars/rent-list/:id
exports.listForRent = async(req, res) => {
    try {
        const { rentalPrice } = req.body;
        const car = await Car.findOne({ _id: req.params.id, owner: req.user._id });
        if (!car) return res.status(404).json({ success: false, message: 'Car not yours' });

        car.forRent = true;
        if (rentalPrice) car.rentalPrice = rentalPrice;
        await car.save();

        res.json({ success: true, data: car });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// PUT /api/cars/:id
exports.updateCar = async(req, res) => {
    try {
        const car = await Car.findOne({ _id: req.params.id, owner: req.user._id });
        if (!car) return res.status(404).json({ success: false, message: 'Car not yours' });

        Object.assign(car, req.body);
        await car.save();

        res.json({ success: true, data: car });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// DELETE /api/cars/:id
exports.deleteCar = async(req, res) => {
    try {
        const car = await Car.findOne({ _id: req.params.id, owner: req.user._id });
        if (!car) return res.status(404).json({ success: false, message: 'Car not yours' });

        await User.findByIdAndUpdate(req.user._id, { $pull: { cars: req.params.id } });
        await car.deleteOne();

        res.json({ success: true, message: 'Car deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/cars/available
exports.getAvailableCars = async(req, res) => {
    try {
        const { page = 1, limit = 10, forSale, forRent, status = 'available' } = req.query;
        const query = {...buildCarFilter(req.query), status: status.split(',') };
        if (forSale !== undefined) query.forSale = forSale === 'true';
        if (forRent !== undefined) query.forRent = forRent === 'true';

        const cars = await Car.find(query)
            .populate('owner', 'name phone')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1 });

        const total = await Car.countDocuments(query);

        res.json({
            success: true,
            data: cars,
            pagination: { page: +page, limit: +limit, total, pages: Math.ceil(total / limit) }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/cars/user/:userId/sale - User's cars for sale
exports.getUserSaleCars = async(req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 10 } = req.query;

        const query = {...buildCarFilter(req.query), owner: userId, forSale: true };

        const cars = await Car.find(query)
            .populate('owner', 'name phone')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1 });

        const total = await Car.countDocuments(query);

        res.json({
            success: true,
            data: cars,
            pagination: { page: +page, limit: +limit, total, pages: Math.ceil(total / limit) }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/cars/user/:userId/rent - User's cars for rent
exports.getUserRentCars = async(req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 10 } = req.query;

        const query = {...buildCarFilter(req.query), owner: userId, forRent: true };

        const cars = await Car.find(query)
            .populate('owner', 'name phone')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1 });

        const total = await Car.countDocuments(query);

        res.json({
            success: true,
            data: cars,
            pagination: { page: +page, limit: +limit, total, pages: Math.ceil(total / limit) }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/cars/search - Full-text search + facets for dropdown UIs.
// Returns matching cars alongside a `facets` object listing the distinct
// makes, models, and years present in the result set so the frontend can
// populate "narrow down" selectors without a separate request.
exports.searchCars = async(req, res) => {
    try {
        const {
            q,
            make,
            model,
            status,
            forSale,
            forRent,
            yearMin,
            yearMax,
            priceMin,
            priceMax,
            page = 1,
            limit = 20,
            sort = 'recent'
        } = req.query;

        const filter = {};

        // Free-text: matches anywhere in make / model / description.
        if (q) {
            const re = { $regex: escapeRegex(q), $options: 'i' };
            filter.$or = [{ make: re }, { model: re }, { description: re }];
        }

        // make/model from dropdown selections — exact match (case-insensitive),
        // comma-separated for multi-select.
        const toExactInList = (value) => ({
            $in: String(value)
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
                .map((v) => new RegExp(`^${escapeRegex(v)}$`, 'i'))
        });
        if (make) filter.make = toExactInList(make);
        if (model) filter.model = toExactInList(model);

        if (yearMin || yearMax) {
            filter.year = {};
            if (yearMin) filter.year.$gte = Number(yearMin);
            if (yearMax) filter.year.$lte = Number(yearMax);
        }
        if (priceMin || priceMax) {
            filter.price = {};
            if (priceMin) filter.price.$gte = Number(priceMin);
            if (priceMax) filter.price.$lte = Number(priceMax);
        }

        if (status) filter.status = { $in: String(status).split(',').map((s) => s.trim()).filter(Boolean) };
        if (forSale !== undefined) filter.forSale = forSale === 'true';
        if (forRent !== undefined) filter.forRent = forRent === 'true';

        const sortMap = {
            recent: { createdAt: -1 },
            priceAsc: { price: 1 },
            priceDesc: { price: -1 },
            yearAsc: { year: 1 },
            yearDesc: { year: -1 }
        };
        const sortBy = sortMap[sort] || sortMap.recent;

        const pageNum = Math.max(1, Number(page));
        const limitNum = Math.max(1, Number(limit));

        const [cars, total, facetsResult] = await Promise.all([
            Car.find(filter)
                .populate('owner', 'name phone')
                .sort(sortBy)
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum),
            Car.countDocuments(filter),
            Car.aggregate([
                { $match: filter },
                {
                    $facet: {
                        makes: [
                            { $group: { _id: '$make', count: { $sum: 1 } } },
                            { $project: { _id: 0, make: '$_id', count: 1 } },
                            { $sort: { count: -1, make: 1 } }
                        ],
                        models: [
                            { $group: { _id: { make: '$make', model: '$model' }, count: { $sum: 1 } } },
                            { $project: { _id: 0, make: '$_id.make', model: '$_id.model', count: 1 } },
                            { $sort: { count: -1, model: 1 } }
                        ],
                        years: [
                            { $group: { _id: '$year', count: { $sum: 1 } } },
                            { $project: { _id: 0, year: '$_id', count: 1 } },
                            { $sort: { year: -1 } }
                        ]
                    }
                }
            ])
        ]);

        const facets = facetsResult[0] || { makes: [], models: [], years: [] };

        res.json({
            success: true,
            data: cars,
            facets,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};