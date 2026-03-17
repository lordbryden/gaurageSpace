const Car = require('../models/car.model');
const User = require('../models/user.model');

// 1. Keep car in garage - POST /api/cars/park
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
                inGarage: true
            });
        }

        await car.save();
        await User.findByIdAndUpdate(owner, { $addToSet: { cars: car._id } });

        res.status(201).json({ success: true, data: car });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 2. Collect car from garage - POST /api/cars/collect/:id
exports.collectCar = async(req, res) => {
    try {
        const car = await Car.findOne({ _id: req.params.id, owner: req.user._id });
        if (!car) return res.status(404).json({ success: false, message: 'Car not found or not owned by you' });

        car.status = 'available';
        car.inGarage = false;
        await car.save();

        res.json({ success: true, data: car });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 3. Buy car - POST /api/cars/buy/:id  (buy available car, transfer owner)
exports.buyCar = async(req, res) => {
    try {
        const car = await Car.findOne({ _id: req.params.id, status: 'available', forSale: true });
        if (!car) return res.status(404).json({ success: false, message: 'Available car for sale not found' });

        car.owner = req.user._id;
        car.status = 'available'; // now owned by buyer
        car.forSale = false;
        await car.save();
        await User.findByIdAndUpdate(req.user._id, { $addToSet: { cars: car._id } });

        res.json({ success: true, data: car });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 4. Sell car - POST /api/cars/sell
exports.sellCar = async(req, res) => {
    try {
        const { carId, price } = req.body;
        const car = await Car.findOne({ _id: carId, owner: req.user._id });
        if (!car) return res.status(404).json({ success: false, message: 'Car not found or not owned by you' });

        car.forSale = true;
        car.price = price || car.price;
        await car.save();

        res.json({ success: true, data: car });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 5. Rent car - POST /api/cars/rent/:id
exports.rentCar = async(req, res) => {
    try {
        const car = await Car.findOne({ _id: req.params.id, status: 'available', forRent: true });
        if (!car) return res.status(404).json({ success: false, message: 'Available car for rent not found' });

        car.status = 'rented';
        // Note: renter temp, real impl needs renter ref/duration
        await car.save();

        res.json({ success: true, data: car });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 6. List car for rent - POST /api/cars/rent-list/:id
exports.listForRent = async(req, res) => {
    try {
        const { rentalPrice } = req.body;
        const car = await Car.findOne({ _id: req.params.id, owner: req.user._id });
        if (!car) return res.status(404).json({ success: false, message: 'Car not found or not owned by you' });

        car.forRent = true;
        car.rentalPrice = rentalPrice;
        await car.save();

        res.json({ success: true, data: car });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 7. Update car - PUT /api/cars/:id
exports.updateCar = async(req, res) => {
    try {
        const updates = req.body;
        const car = await Car.findOne({ _id: req.params.id, owner: req.user._id });
        if (!car) return res.status(404).json({ success: false, message: 'Car not found or not owned by you' });

        Object.assign(car, updates);
        await car.save();

        res.json({ success: true, data: car });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 8. Delete car - DELETE /api/cars/:id
exports.deleteCar = async(req, res) => {
    try {
        const car = await Car.findOne({ _id: req.params.id, owner: req.user._id });
        if (!car) return res.status(404).json({ success: false, message: 'Car not found or not owned by you' });

        await User.findByIdAndUpdate(req.user._id, { $pull: { cars: req.params.id } });
        await car.remove();

        res.json({ success: true, message: 'Car deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};