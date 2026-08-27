const express = require('express');
const Settings = require('../models/Settings');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const router = express.Router();

// @route GET /api/settings
// @desc Get current system settings (fare, commission)
router.get('/', protect, async (req, res) => {
  try {
    let settings = await Settings.findOne();
    
    if (!settings) {
      settings = await Settings.create({});
    }

    res.json(settings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route PUT /api/settings
// @desc Update system settings
router.put('/', protect, adminOnly, async (req, res) => {
  try {
    const { fareRates, commission } = req.body;
    
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }

    if (fareRates) settings.fareRates = fareRates;
    if (commission) settings.commission = commission;
    
    settings.updatedBy = req.user._id;
    settings.updatedAt = Date.now();

    await settings.save();
    res.json(settings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
