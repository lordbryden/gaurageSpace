const Car = require('../models/car.model');
const User = require('../models/user.model');

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
        const query = { status: status.split(',') };
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