const express = require('express');
const Hospital = require('../models/Hospital');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// @route GET /api/hospitals
// @desc Get all hospitals (optionally search via ?search= query)
router.get('/', async (req, res) => {
  try {
    const { search, limit = 100 } = req.query;
    let query = {};
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query = {
        $or: [
          { name: searchRegex },
          { address: searchRegex },
          { specialties: searchRegex }
        ]
      };
    }
    const hospitals = await Hospital.find(query)
      .sort({ name: 1 })
      .limit(parseInt(limit));
    res.json(hospitals);
  } catch (error) {
    console.error('Error fetching hospitals:', error);
    res.status(500).json({ message: 'Server error fetching hospitals' });
  }
});

// @route GET /api/hospitals/nearest
// @desc Get nearest hospitals based on coordinates
router.get('/nearest', async (req, res) => {
  try {
    const { lat, lng, limit = 20 } = req.query;

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
          $maxDistance: 35000, // 35km to cover entire Surat & surroundings
        },
      },
    }).limit(parseInt(limit));

    res.json(hospitals);
  } catch (error) {
    console.error('Error fetching nearest hospitals:', error);
    // Fallback: return all hospitals if $near fails (e.g. index issue)
    try {
      const allHospitals = await Hospital.find().limit(50);
      res.json(allHospitals);
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  }
});

// @route GET /api/hospitals/search
// @desc Search hospitals by name, address, or specialty
router.get('/search', async (req, res) => {
  try {
    const { query, limit = 20 } = req.query;
    
    if (!query || !query.trim()) {
      const allHospitals = await Hospital.find().sort({ name: 1 }).limit(parseInt(limit));
      return res.json(allHospitals);
    }

    const searchRegex = new RegExp(query.trim(), 'i');
    const hospitals = await Hospital.find({
      $or: [
        { name: searchRegex },
        { address: searchRegex },
        { specialties: searchRegex }
      ]
    }).limit(parseInt(limit));

    res.json(hospitals);
  } catch (error) {
    console.error('Error searching hospitals:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

