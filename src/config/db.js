const mongoose = require("mongoose");

const connectDB = async() => {
    try {
        mongoose.connect(process.env.MONGO_URI, {
            dbName: "AutoGarauge", // forces the database
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log("MongoDB Connected ✅");
    } catch (error) {
        console.error("Database connection failed ❌");
        process.exit(1);
    }
};

module.exports = connectDB;