require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const fsp = require("fs/promises");
const path = require("path");

const User = require("../models/user.model");
const Car = require("../models/car.model");
const Advert = require("../models/advert.model");
const { resolveSeedImage } = require("./downloadImage");

const SEED_USER = {
    name: "Seed User",
    phone: "700000001",
    password: "seeder123",
};

const days = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);
const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

// Variety is deliberate: boosted vs expired-boost vs unboosted, linked vs
// standalone, and mixed statuses so the list/featured endpoints can be tested
// end-to-end against realistic data.
const ADVERT_TEMPLATES = [
    {
        title: "Brand new 2024 Tesla Model Y — limited offer",
        description: "Top trim, full self-driving package, pristine condition. Delivery available nationwide.",
        make: "Tesla",
        model: "Model Y",
        year: 2024,
        price: 62000,
        contactPhone: "700000001",
        priority: 10,
        priorityUntil: days(14),
        status: "active",
        linkCar: false,
    },
    {
        title: "Premium BMW X5 for rent — weekends only",
        description: "Perfect for weekend getaways. Fully insured. Contact for availability.",
        make: "BMW",
        model: "X5",
        year: 2022,
        price: 250,
        contactPhone: "700000001",
        priority: 8,
        priorityUntil: days(7),
        status: "active",
        linkCar: true,
    },
    {
        title: "Classic Ford Mustang — collector's item",
        description: "Restored to original spec, numbers-matching, rare colour. Serious inquiries only.",
        make: "Ford",
        model: "Mustang",
        year: 1967,
        price: 85000,
        contactPhone: "700000001",
        priority: 5,
        priorityUntil: days(30),
        status: "active",
        linkCar: false,
    },
    {
        title: "Daily driver Toyota Corolla — low mileage",
        description: "Perfect first car, fuel efficient, recently serviced.",
        make: "Toyota",
        model: "Corolla",
        year: 2020,
        price: 17500,
        contactPhone: "700000001",
        priority: 0,
        priorityUntil: null,
        status: "active",
        linkCar: true,
    },
    {
        title: "Honda Civic — well maintained",
        description: "Great condition, clean title, smooth ride.",
        make: "Honda",
        model: "Civic",
        year: 2019,
        price: 16000,
        contactPhone: "700000001",
        priority: 0,
        priorityUntil: null,
        status: "active",
        linkCar: true,
    },
    {
        title: "Mercedes C-Class — like new",
        description: "Showroom condition, low miles, premium audio package.",
        make: "Mercedes-Benz",
        model: "C-Class",
        year: 2021,
        price: 41000,
        contactPhone: "700000001",
        priority: 3,
        priorityUntil: daysAgo(2), // expired boost — tests fallback into regular pool
        status: "active",
        linkCar: false,
    },
    {
        title: "Audi A4 Quattro — premium sedan",
        description: "All-wheel drive, panoramic roof, virtual cockpit.",
        make: "Audi",
        model: "A4",
        year: 2021,
        price: 36500,
        contactPhone: "700000001",
        priority: 0,
        priorityUntil: null,
        status: "paused", // paused — should not surface in list/featured
        linkCar: false,
    },
    {
        title: "Volkswagen Golf GTI — enthusiast choice",
        description: "Stock, no mods, full service history, winter tyres included.",
        make: "Volkswagen",
        model: "Golf",
        year: 2018,
        price: 15000,
        contactPhone: "700000001",
        priority: 0,
        priorityUntil: null,
        status: "active",
        linkCar: true,
    },
    {
        title: "Chevrolet Camaro SS — weekend beast",
        description: "V8 rumble, track-ready, full service records.",
        make: "Chevrolet",
        model: "Camaro",
        year: 2020,
        price: 37000,
        contactPhone: "700000001",
        priority: 7,
        priorityUntil: days(3),
        status: "active",
        linkCar: false,
    },
    {
        title: "Nissan Altima — reliable family sedan",
        description: "Comfortable ride, great fuel economy, recently detailed.",
        make: "Nissan",
        model: "Altima",
        year: 2019,
        price: 15500,
        contactPhone: "700000001",
        priority: 0,
        priorityUntil: null,
        status: "draft", // draft — should not surface in list/featured
        linkCar: false,
    },
];

const UPLOADS_DIR = path.join(__dirname, "..", "..", "uploads", "adverts");
const LOCAL_ASSETS_DIR = path.join(__dirname, "assets", "adverts");

const ensureDir = async(dir) => {
    await fsp.mkdir(dir, { recursive: true });
};

const run = async() => {
    if (!process.env.MONGO_URI) {
        console.error("MONGO_URI missing from .env");
        process.exit(1);
    }

    await ensureDir(UPLOADS_DIR);

    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");

    // Reuse (or create) the same seed user the car seeder uses, so "linked"
    // adverts can attach to cars this user already owns. The seed user is
    // also the project's super_admin.
    let user = await User.findOne({ phone: SEED_USER.phone });
    if (!user) {
        const hashed = await bcrypt.hash(SEED_USER.password, 10);
        user = await User.create({
            name: SEED_USER.name,
            phone: SEED_USER.phone,
            password: hashed,
            role: 'super_admin',
        });
        console.log(`Created seed user as super_admin (phone: ${SEED_USER.phone}, password: ${SEED_USER.password})`);
    } else if (user.role !== 'super_admin') {
        user.role = 'super_admin';
        await user.save();
        console.log(`Reusing seed user (phone: ${SEED_USER.phone}); promoted to super_admin`);
    } else {
        console.log(`Reusing seed user (phone: ${SEED_USER.phone}, role: super_admin)`);
    }

    const removed = await Advert.deleteMany({ owner: user._id });
    if (removed.deletedCount) console.log(`Removed ${removed.deletedCount} existing adverts for seed user`);

    // Index seed user's cars by make|model so templates with linkCar:true can
    // find and attach a real car id. If the car seeder hasn't been run yet,
    // these adverts gracefully fall back to standalone.
    const cars = await Car.find({ owner: user._id });
    const carByMakeModel = new Map();
    for (const c of cars) {
        carByMakeModel.set(`${c.make.toLowerCase()}|${c.model.toLowerCase()}`, c._id);
    }
    console.log(`Found ${cars.length} owned cars available for linking`);

    console.log("Preparing adverts...");
    const docs = [];
    for (let i = 0; i < ADVERT_TEMPLATES.length; i++) {
        const tpl = ADVERT_TEMPLATES[i];
        const imagePath = await resolveSeedImage({
            idx: i,
            make: tpl.make,
            model: tpl.model,
            uploadsDir: UPLOADS_DIR,
            localAssetsDir: LOCAL_ASSETS_DIR,
            filenamePrefix: "seed_advert",
            publicPrefix: "/adverts",
        });

        let carId = null;
        if (tpl.linkCar) {
            const key = `${tpl.make.toLowerCase()}|${tpl.model.toLowerCase()}`;
            carId = carByMakeModel.get(key) || null;
        }

        docs.push({
            owner: user._id,
            car: carId,
            title: tpl.title,
            description: tpl.description,
            make: tpl.make,
            model: tpl.model,
            year: tpl.year,
            price: tpl.price,
            contactPhone: tpl.contactPhone,
            priority: tpl.priority,
            priorityUntil: tpl.priorityUntil,
            status: tpl.status,
            images: imagePath ? [imagePath] : [],
        });
    }

    const created = await Advert.insertMany(docs);
    const linked = created.filter((a) => a.car).length;
    console.log(`Seeded ${created.length} adverts (${linked} linked to cars, ${created.length - linked} standalone)`);

    await mongoose.disconnect();
    console.log("Done");
};

run().catch(async(err) => {
    console.error("Seeder failed:", err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
