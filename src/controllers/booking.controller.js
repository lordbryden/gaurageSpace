const mongoose = require('mongoose');
const Booking = require('../models/booking.model');
const Car = require('../models/car.model');

const DAY_MS = 24 * 60 * 60 * 1000;

const parseDate = (v) => {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
};

const carPopulate = {
    path: 'car',
    populate: { path: 'owner', select: 'name phone' },
};

// Translate the status virtual into a concrete Mongo predicate so we can still
// filter with it server-side without loading every row.
const statusToQuery = (status, now = new Date()) => {
    switch (status) {
        case 'cancelled':
            return { cancelledAt: { $ne: null } };
        case 'completed':
            return { cancelledAt: null, endDate: { $lt: now } };
        case 'active':
            return { cancelledAt: null, startDate: { $lte: now }, endDate: { $gte: now } };
        case 'pending':
            return { cancelledAt: null, startDate: { $gt: now } };
        default:
            return null;
    }
};

// POST /api/bookings
exports.createBooking = async(req, res) => {
    try {
        const { carId, startDate, endDate, notes } = req.body;

        if (!carId || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'carId, startDate and endDate are required'
            });
        }
        if (!mongoose.Types.ObjectId.isValid(carId)) {
            return res.status(400).json({ success: false, message: 'Invalid carId' });
        }

        const start = parseDate(startDate);
        const end = parseDate(endDate);
        if (!start || !end) return res.status(400).json({ success: false, message: 'Invalid date(s)' });
        if (end <= start) return res.status(400).json({ success: false, message: 'endDate must be after startDate' });

        const car = await Car.findById(carId);
        if (!car) return res.status(404).json({ success: false, message: 'Car not found' });
        if (!car.forRent) return res.status(400).json({ success: false, message: 'Car is not listed for rent' });
        if (!car.rentalPrice) return res.status(400).json({ success: false, message: 'Car has no rental price set' });

        // Refuse overlapping bookings for the same car (ignoring cancelled).
        const overlap = await Booking.findOne({
            car: carId,
            cancelledAt: null,
            endDate: { $gte: start },
            startDate: { $lte: end },
        });
        if (overlap) {
            return res.status(400).json({
                success: false,
                message: 'Car already booked for part of that period'
            });
        }

        const days = Math.max(1, Math.ceil((end - start) / DAY_MS));
        const totalCost = days * car.rentalPrice;

        const created = await Booking.create({
            user: req.user._id,
            car: carId,
            startDate: start,
            endDate: end,
            days,
            rentalPrice: car.rentalPrice,
            totalCost,
            notes,
        });

        const booking = await Booking.findById(created._id).populate(carPopulate);
        res.status(201).json({ success: true, data: booking });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/bookings — caller's own bookings, optional status filter
exports.listMyBookings = async(req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;

        const query = { user: req.user._id };
        const statusQ = statusToQuery(status);
        if (statusQ) Object.assign(query, statusQ);

        const pageNum = Math.max(1, Number(page));
        const limitNum = Math.max(1, Number(limit));

        const [bookings, total] = await Promise.all([
            Booking.find(query)
            .populate(carPopulate)
            .sort({ startDate: -1 })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum),
            Booking.countDocuments(query),
        ]);

        res.json({
            success: true,
            data: bookings,
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

// GET /api/bookings/stats — single aggregate pass for the caller's activity
exports.getMyStats = async(req, res) => {
    try {
        const now = new Date();
        const userId = new mongoose.Types.ObjectId(req.user._id);

        const [facets] = await Booking.aggregate([
            { $match: { user: userId } },
            {
                $facet: {
                    total: [{ $count: 'count' }],
                    cancelled: [
                        { $match: { cancelledAt: { $ne: null } } },
                        { $count: 'count' }
                    ],
                    completed: [
                        { $match: { cancelledAt: null, endDate: { $lt: now } } },
                        { $count: 'count' }
                    ],
                    active: [
                        { $match: { cancelledAt: null, startDate: { $lte: now }, endDate: { $gte: now } } },
                        { $count: 'count' }
                    ],
                    pending: [
                        { $match: { cancelledAt: null, startDate: { $gt: now } } },
                        { $count: 'count' }
                    ],
                    totalSpent: [
                        { $match: { cancelledAt: null, endDate: { $lt: now } } },
                        { $group: { _id: null, sum: { $sum: '$totalCost' } } }
                    ],
                }
            }
        ]);

        const count = (arr) => (arr && arr[0] && arr[0].count) || 0;
        const sum = (arr) => (arr && arr[0] && arr[0].sum) || 0;

        res.json({
            success: true,
            data: {
                total: count(facets.total),
                pending: count(facets.pending),
                active: count(facets.active),
                completed: count(facets.completed),
                cancelled: count(facets.cancelled),
                totalSpent: sum(facets.totalSpent),
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/bookings/:id
exports.getBooking = async(req, res) => {
    try {
        const booking = await Booking.findOne({
            _id: req.params.id,
            user: req.user._id
        }).populate(carPopulate);

        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
        res.json({ success: true, data: booking });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// PUT /api/bookings/:id — allows changing dates or notes while the booking
// is still pending or active. Cancelled / completed bookings are frozen.
exports.updateBooking = async(req, res) => {
    try {
        const booking = await Booking.findOne({ _id: req.params.id, user: req.user._id });
        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
        if (booking.cancelledAt) return res.status(400).json({ success: false, message: 'Cannot update a cancelled booking' });
        if (booking.endDate < new Date()) return res.status(400).json({ success: false, message: 'Cannot update a completed booking' });

        const { startDate, endDate, notes } = req.body;

        const newStart = startDate ? parseDate(startDate) : booking.startDate;
        const newEnd = endDate ? parseDate(endDate) : booking.endDate;
        if (startDate && !newStart) return res.status(400).json({ success: false, message: 'Invalid startDate' });
        if (endDate && !newEnd) return res.status(400).json({ success: false, message: 'Invalid endDate' });
        if (newEnd <= newStart) return res.status(400).json({ success: false, message: 'endDate must be after startDate' });

        const datesChanged =
            (startDate && newStart.getTime() !== booking.startDate.getTime()) ||
            (endDate && newEnd.getTime() !== booking.endDate.getTime());

        if (datesChanged) {
            const overlap = await Booking.findOne({
                _id: { $ne: booking._id },
                car: booking.car,
                cancelledAt: null,
                endDate: { $gte: newStart },
                startDate: { $lte: newEnd },
            });
            if (overlap) return res.status(400).json({ success: false, message: 'Car already booked for that period' });

            const days = Math.max(1, Math.ceil((newEnd - newStart) / DAY_MS));
            booking.startDate = newStart;
            booking.endDate = newEnd;
            booking.days = days;
            booking.totalCost = days * booking.rentalPrice;
        }
        if (notes !== undefined) booking.notes = notes;

        await booking.save();
        const populated = await Booking.findById(booking._id).populate(carPopulate);
        res.json({ success: true, data: populated });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/bookings/:id/cancel
exports.cancelBooking = async(req, res) => {
    try {
        const booking = await Booking.findOne({ _id: req.params.id, user: req.user._id });
        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
        if (booking.cancelledAt) return res.status(400).json({ success: false, message: 'Booking is already cancelled' });
        if (booking.endDate < new Date()) return res.status(400).json({ success: false, message: 'Cannot cancel a completed booking' });

        booking.cancelledAt = new Date();
        if (req.body.reason) booking.cancelReason = req.body.reason;
        await booking.save();

        const populated = await Booking.findById(booking._id).populate(carPopulate);
        res.json({ success: true, data: populated });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// DELETE /api/bookings/:id — hard delete (user cleaning up their history)
exports.deleteBooking = async(req, res) => {
    try {
        const booking = await Booking.findOneAndDelete({ _id: req.params.id, user: req.user._id });
        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
        res.json({ success: true, message: 'Booking deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
