const express = require('express');
const router = express.Router();
const LocationHistory = require('../models/LocationHistory');
const { protect } = require('../middleware/authMiddleware');

// @route   GET /api/location/trail/:bookingId
// @desc    Get location trail for a booking
// @access  Private
router.get('/trail/:bookingId', protect, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { startTime, endTime } = req.query;

    const trail = await LocationHistory.getBookingTrail(bookingId, startTime, endTime);

    res.json({
      success: true,
      count: trail.length,
      data: trail
    });
  } catch (error) {
    console.error('Error fetching location trail:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching location trail',
      error: error.message
    });
  }
});

// @route   GET /api/location/driver/:driverId/recent
// @desc    Get recent location of a driver
// @access  Private
router.get('/driver/:driverId/recent', protect, async (req, res) => {
  try {
    const { driverId } = req.params;
    const { minutes } = req.query;

    const location = await LocationHistory.getRecentLocation(
      driverId, 
      minutes ? parseInt(minutes) : 5
    );

    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'No recent location found for this driver'
      });
    }

    res.json({
      success: true,
      data: location
    });
  } catch (error) {
    console.error('Error fetching driver location:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching driver location',
      error: error.message
    });
  }
});

// @route   GET /api/location/distance/:bookingId
// @desc    Calculate total distance traveled for a booking
// @access  Private
router.get('/distance/:bookingId', protect, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const distance = await LocationHistory.calculateDistance(bookingId);

    res.json({
      success: true,
      data: {
        bookingId,
        distance: distance.toFixed(2), // km
        distanceMiles: (distance * 0.621371).toFixed(2)
      }
    });
  } catch (error) {
    console.error('Error calculating distance:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating distance',
      error: error.message
    });
  }
});

// @route   GET /api/location/driver/:driverId/history
// @desc    Get location history for a driver
// @access  Private (Driver/Admin only)
router.get('/driver/:driverId/history', protect, async (req, res) => {
  try {
    const { driverId } = req.params;
    const { startDate, endDate, limit = 100 } = req.query;

    // Check if user is the driver or admin
    if (req.user.id !== driverId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this driver\'s location history'
      });
    }

    const query = { driverId };
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const history = await LocationHistory.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .select('location accuracy speed heading bookingId timestamp')
      .lean();

    res.json({
      success: true,
      count: history.length,
      data: history
    });
  } catch (error) {
    console.error('Error fetching location history:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching location history',
      error: error.message
    });
  }
});

// @route   DELETE /api/location/cleanup/:driverId
// @desc    Delete old location history for a driver (admin only)
// @access  Private (Admin)
router.delete('/cleanup/:driverId', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can perform cleanup'
      });
    }

    const { driverId } = req.params;
    const { daysOld = 30 } = req.query;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(daysOld));

    const result = await LocationHistory.deleteMany({
      driverId,
      timestamp: { $lt: cutoffDate }
    });

    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} location records older than ${daysOld} days`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error cleaning up location history:', error);
    res.status(500).json({
      success: false,
      message: 'Error cleaning up location history',
      error: error.message
    });
  }
});

module.exports = router;
