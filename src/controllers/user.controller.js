const User = require("../models/user.model");
const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");

// CREATE user (already done)
exports.registerUser = async(req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, phone, password, repeatPassword } = req.body;

    if (password !== repeatPassword) {
        return res.status(400).json({ success: false, message: "Passwords do not match" });
    }

    try {
        const existingUser = await User.findOne({ phone });
        if (existingUser) {
            return res.status(400).json({ success: false, message: "Phone already registered" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await User.create({ name, phone, password: hashedPassword });

        res.status(201).json({ success: true, data: { id: newUser._id, name: newUser.name, phone: newUser.phone } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET all users
exports.getAllUsers = async(req, res) => {
    try {
        const users = await User.find({}, "-password"); // exclude password
        res.status(200).json({ success: true, data: users });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET single user by id
exports.getUserById = async(req, res) => {
    try {
        const user = await User.findById(req.params.id, "-password");
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// UPDATE user
exports.updateUser = async(req, res) => {
    try {
        const { name, phone, password, repeatPassword } = req.body;

        const updateData = {};
        if (name) updateData.name = name;
        if (phone) updateData.phone = phone;
        if (password) {
            if (password !== repeatPassword) {
                return res.status(400).json({ success: false, message: "Passwords do not match" });
            }
            updateData.password = await bcrypt.hash(password, 10);
        }

        const updatedUser = await User.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true }).select("-password");
        if (!updatedUser) return res.status(404).json({ success: false, message: "User not found" });

        res.status(200).json({ success: true, data: updatedUser });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// DELETE user
exports.deleteUser = async(req, res) => {
    try {
        const deletedUser = await User.findByIdAndDelete(req.params.id);
        if (!deletedUser) return res.status(404).json({ success: false, message: "User not found" });

        res.status(200).json({ success: true, message: "User deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};