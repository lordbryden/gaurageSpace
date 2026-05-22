const Setting = require('../models/setting.model');
const { logAudit } = require('../utils/auditLog');

const allSettingsAsMap = async() => {
    const docs = await Setting.find();
    const out = {};
    for (const d of docs) out[d.key] = d.value;
    return out;
};

// GET /api/settings — returns all settings as a flat key→value map
exports.getSettings = async(req, res) => {
    try {
        const settings = await allSettingsAsMap();
        res.json({ success: true, data: settings });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/settings — body is an object of key→value pairs. Each is upserted.
// Returns the post-update settings map.
exports.updateSettings = async(req, res) => {
    try {
        const updates = req.body;
        if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
            return res.status(400).json({
                success: false,
                message: 'Body must be a JSON object of key/value pairs',
            });
        }

        const keys = Object.keys(updates);
        if (!keys.length) {
            return res.status(400).json({ success: false, message: 'No settings provided' });
        }

        const ops = keys.map((key) => ({
            updateOne: {
                filter: { key },
                update: { $set: { value: updates[key] } },
                upsert: true,
            },
        }));
        await Setting.bulkWrite(ops);

        const settings = await allSettingsAsMap();

        await logAudit({
            actor: req.user,
            action: 'settings.update',
            target: { type: 'settings' },
            meta: { keys },
        });

        res.json({ success: true, data: settings });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
