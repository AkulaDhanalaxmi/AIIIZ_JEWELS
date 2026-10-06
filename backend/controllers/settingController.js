const Setting = require('../models/Setting');
const mongoose = require('mongoose');

const PROMOTIONAL_BANNERS_KEY = 'promotional_banners';

function normalizePromotionalBanners(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(banner => banner && typeof banner === 'object' && typeof banner.id === 'string' && typeof banner.image === 'string')
    .map(banner => ({
      id: banner.id,
      image: banner.image,
      title: typeof banner.title === 'string' ? banner.title : '',
      active: banner.active !== false,
      displayOrder: Number.isInteger(Number(banner.displayOrder)) ? Number(banner.displayOrder) : 0,
    }))
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

function validBannerImageUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch (err) {
    return false;
  }
}

async function readPromotionalBanners() {
  const setting = await Setting.findOne({ key: PROMOTIONAL_BANNERS_KEY }).lean();
  return normalizePromotionalBanners(setting ? setting.value : []);
}

async function writePromotionalBanners(banners) {
  const setting = await Setting.findOneAndUpdate(
    { key: PROMOTIONAL_BANNERS_KEY },
    { value: banners },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return normalizePromotionalBanners(setting.value);
}

async function getSetting(req, res) {
  try {
    const key = req.params.key;
    const setting = await Setting.findOne({ key }).lean();
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

async function getPromotionalBanners(req, res) {
  try {
    const banners = await readPromotionalBanners();
    return res.json({ banners: banners.filter(banner => banner.active).map(({ id, image, title, displayOrder }) => ({ id, image, title, displayOrder })) });
  } catch (err) {
    console.error('Could not load promotional banners', err);
    return res.status(500).json({ message: 'Could not load promotional banners' });
  }
}

async function getAdminPromotionalBanners(req, res) {
  try {
    return res.json({ banners: await readPromotionalBanners() });
  } catch (err) {
    console.error('Could not load promotional banners for admin', err);
    return res.status(500).json({ message: 'Could not load promotional banners' });
  }
}

async function createPromotionalBanner(req, res) {
  const image = typeof req.body.image === 'string' ? req.body.image.trim() : '';
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
  if (!validBannerImageUrl(image)) return res.status(400).json({ message: 'Banner image must be a valid HTTPS image URL' });
  if (title.length > 120) return res.status(400).json({ message: 'Banner title must be 120 characters or fewer' });
  if (req.body.active !== undefined && typeof req.body.active !== 'boolean') {
    return res.status(400).json({ message: 'Banner active must be true or false' });
  }

  try {
    const banners = await readPromotionalBanners();
    const displayOrder = banners.reduce((max, banner) => Math.max(max, banner.displayOrder), 0) + 1;
    banners.push({
      id: new mongoose.Types.ObjectId().toString(),
      image,
      title,
      active: req.body.active !== false,
      displayOrder,
    });
    return res.status(201).json({ banners: await writePromotionalBanners(banners) });
  } catch (err) {
    console.error('Could not create promotional banner', err);
    return res.status(500).json({ message: 'Could not create promotional banner' });
  }
}

async function updatePromotionalBanner(req, res) {
  const { id } = req.params;
  const updates = {};
  if (Object.prototype.hasOwnProperty.call(req.body, 'image')) {
    if (!validBannerImageUrl(req.body.image)) return res.status(400).json({ message: 'Banner image must be a valid HTTPS image URL' });
    updates.image = req.body.image.trim();
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'title')) {
    if (typeof req.body.title !== 'string' || req.body.title.trim().length > 120) {
      return res.status(400).json({ message: 'Banner title must be 120 characters or fewer' });
    }
    updates.title = req.body.title.trim();
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'active')) {
    if (typeof req.body.active !== 'boolean') return res.status(400).json({ message: 'Banner active must be true or false' });
    updates.active = req.body.active;
  }
  if (!Object.keys(updates).length) return res.status(400).json({ message: 'No banner changes provided' });

  try {
    const banners = await readPromotionalBanners();
    const banner = banners.find(item => item.id === id);
    if (!banner) return res.status(404).json({ message: 'Promotional banner not found' });
    Object.assign(banner, updates);
    return res.json({ banners: await writePromotionalBanners(banners) });
  } catch (err) {
    console.error('Could not update promotional banner', err);
    return res.status(500).json({ message: 'Could not update promotional banner' });
  }
}

async function deletePromotionalBanner(req, res) {
  try {
    const banners = await readPromotionalBanners();
    const remaining = banners.filter(banner => banner.id !== req.params.id);
    if (remaining.length === banners.length) return res.status(404).json({ message: 'Promotional banner not found' });
    remaining.forEach((banner, index) => { banner.displayOrder = index + 1; });
    return res.json({ banners: await writePromotionalBanners(remaining) });
  } catch (err) {
    console.error('Could not delete promotional banner', err);
    return res.status(500).json({ message: 'Could not delete promotional banner' });
  }
}

async function reorderPromotionalBanners(req, res) {
  const ids = req.body.ids;
  if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length) {
    return res.status(400).json({ message: 'Banner order must contain unique banner IDs' });
  }
  try {
    const banners = await readPromotionalBanners();
    if (ids.length !== banners.length || ids.some(id => !banners.some(banner => banner.id === id))) {
      return res.status(400).json({ message: 'Banner order must include every existing banner once' });
    }
    const byId = new Map(banners.map(banner => [banner.id, banner]));
    const reordered = ids.map((id, index) => ({ ...byId.get(id), displayOrder: index + 1 }));
    return res.json({ banners: await writePromotionalBanners(reordered) });
  } catch (err) {
    console.error('Could not reorder promotional banners', err);
    return res.status(500).json({ message: 'Could not reorder promotional banners' });
  }
}

module.exports = {
  getSetting,
  saveSetting,
  getPromotionalBanners,
  getAdminPromotionalBanners,
  createPromotionalBanner,
  updatePromotionalBanner,
  deletePromotionalBanner,
  reorderPromotionalBanners,
};
