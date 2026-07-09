const express = require('express');
const Hospital = require('../models/Hospital');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// @route GET /api/hospitals/nearest
// @desc Get nearest hospitals
router.get('/nearest', protect, async (req, res) => {
  try {
    const { lat, lng, limit = 5 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ message: 'Latitude and Longitude are required' });
    }

    const hospitals = await Hospital.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          $maxDistance: 20000, // 20km
        },
      },
    }).limit(parseInt(limit));

    res.json(hospitals);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route GET /api/hospitals/search
// @desc Search hospitals by name
router.get('/search', protect, async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const hospitals = await Hospital.find({
      name: { $regex: query, $options: 'i' }
    }).limit(10);

    res.json(hospitals);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
