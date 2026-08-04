const Setting = require('../models/Setting');

async function getSetting(req, res) {
  try {
    const key = req.params.key;
    const setting = await Setting.findOne({ key });
    return res.json({ setting: setting ? setting.value : null });
  } catch (err) {
    return res.status(500).json({ message: 'Could not load setting' });
  }
}

async function saveSetting(req, res) {
  try {
    const key = req.params.key;
    const value = req.body.value;
    if (!value) return res.status(400).json({ message: 'Missing value' });
    const setting = await Setting.findOneAndUpdate(
      { key },
      { value },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return res.json({ setting: setting.value });
  } catch (err) {
    return res.status(500).json({ message: 'Could not save setting' });
  }
}

module.exports = { getSetting, saveSetting };
