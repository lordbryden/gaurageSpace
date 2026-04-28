require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const fsp = require("fs/promises");
const path = require("path");

const User = require("../models/user.model");
const Car = require("../models/car.model");
const { resolveSeedImage } = require("./downloadImage");

const SEED_USER = {
    name: "Seed User",
    phone: "700000001",
    password: "seeder123",
};

const CAR_TEMPLATES = [
    { make: "Toyota", model: "Corolla", year: 2020, price: 18000, rentalPrice: 60, status: "available", forSale: true, forRent: false, inGarage: false, description: "Reliable daily driver, single owner.", fuelType: "petrol", transmission: "automatic", color: "white", bodyType: "sedan", mileage: 35000 },
    { make: "Honda", model: "Civic", year: 2019, price: 16500, rentalPrice: 55, status: "available", forSale: true, forRent: true, inGarage: false, description: "Fuel efficient, clean interior.", fuelType: "petrol", transmission: "manual", color: "silver", bodyType: "sedan", mileage: 48000 },
    { make: "Ford", model: "Mustang", year: 2021, price: 42000, rentalPrice: 150, status: "available", forSale: false, forRent: true, inGarage: false, description: "V8, low mileage, weekend cruiser.", fuelType: "petrol", transmission: "manual", color: "red", bodyType: "coupe", mileage: 12000 },
    { make: "BMW", model: "X5", year: 2022, price: 68000, rentalPrice: 200, status: "available", forSale: true, forRent: false, inGarage: false, description: "Full service history, panoramic roof.", fuelType: "diesel", transmission: "automatic", color: "black", bodyType: "suv", mileage: 18000 },
    { make: "Tesla", model: "Model 3", year: 2023, price: 51000, rentalPrice: 180, status: "available", forSale: true, forRent: true, inGarage: false, description: "Autopilot, long range battery.", fuelType: "electric", transmission: "automatic", color: "blue", bodyType: "sedan", mileage: 8000 },
    { make: "Mercedes-Benz", model: "C-Class", year: 2020, price: 39500, rentalPrice: 140, status: "parked", forSale: false, forRent: false, inGarage: true, description: "Parked in garage, ready when needed.", fuelType: "petrol", transmission: "automatic", color: "grey", bodyType: "sedan", mileage: 25000 },
    { make: "Audi", model: "A4", year: 2021, price: 37000, rentalPrice: 130, status: "available", forSale: true, forRent: false, inGarage: false, description: "Quattro AWD, premium sound.", fuelType: "diesel", transmission: "automatic", color: "white", bodyType: "sedan", mileage: 22000 },
    { make: "Volkswagen", model: "Golf", year: 2018, price: 14000, rentalPrice: 50, status: "available", forSale: false, forRent: true, inGarage: false, description: "Compact and economical.", fuelType: "petrol", transmission: "manual", color: "red", bodyType: "hatchback", mileage: 65000 },
    { make: "Nissan", model: "Altima", year: 2019, price: 15500, rentalPrice: 55, status: "sold", forSale: false, forRent: false, inGarage: false, description: "Previously sold through the platform.", fuelType: "petrol", transmission: "automatic", color: "silver", bodyType: "sedan", mileage: 55000 },
    { make: "Chevrolet", model: "Camaro", year: 2020, price: 36000, rentalPrice: 140, status: "rented", forSale: false, forRent: true, inGarage: false, description: "Currently out on rent.", fuelType: "petrol", transmission: "automatic", color: "yellow", bodyType: "coupe", mileage: 15000 },
];

const UPLOADS_DIR = path.join(__dirname, "..", "..", "uploads", "cars");
const LOCAL_ASSETS_DIR = path.join(__dirname, "assets", "cars");

const ensureDir = async(dir) => {
    await fsp.mkdir(dir, { recursive: true });
};

const randomVin = () => {
    const chars = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
    let out = "";
    for (let i = 0; i < 17; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
};

const run = async() => {
    if (!process.env.MONGO_URI) {
        console.error("MONGO_URI missing from .env");
        process.exit(1);
    }

    await ensureDir(UPLOADS_DIR);

    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");

    // Ensure a seed user exists so we have an owner for the cars.
    let user = await User.findOne({ phone: SEED_USER.phone });
    if (!user) {
        const hashed = await bcrypt.hash(SEED_USER.password, 10);
        user = await User.create({ name: SEED_USER.name, phone: SEED_USER.phone, password: hashed });
        console.log(`Created seed user (phone: ${SEED_USER.phone}, password: ${SEED_USER.password})`);
    } else {
        console.log(`Reusing existing seed user (phone: ${SEED_USER.phone})`);
    }

    // Idempotent: drop cars previously seeded for this user so re-runs don't
    // accumulate duplicates. Cached image files in uploads/cars/ are kept.
    const removed = await Car.deleteMany({ owner: user._id });
    if (removed.deletedCount) console.log(`Removed ${removed.deletedCount} existing cars for seed user`);

    console.log("Preparing images...");
    const docs = [];
    for (let i = 0; i < CAR_TEMPLATES.length; i++) {
        const tpl = CAR_TEMPLATES[i];
        const imagePath = await resolveSeedImage({
            idx: i,
            make: tpl.make,
            model: tpl.model,
            uploadsDir: UPLOADS_DIR,
            localAssetsDir: LOCAL_ASSETS_DIR,
            filenamePrefix: "seed",
            publicPrefix: "/cars",
        });
        docs.push({
            ...tpl,
            owner: user._id,
            vin: randomVin(),
            images: imagePath ? [imagePath] : [],
        });
    }

    const created = await Car.insertMany(docs);
    await User.findByIdAndUpdate(user._id, { $addToSet: { cars: { $each: created.map((c) => c._id) } } });

    console.log(`Seeded ${created.length} cars`);
    await mongoose.disconnect();
    console.log("Done");
};

run().catch(async(err) => {
    console.error("Seeder failed:", err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
