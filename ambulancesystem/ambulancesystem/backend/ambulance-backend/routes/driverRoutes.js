const express = require('express');
const Driver = require('../models/Driver');
const Booking = require('../models/Booking');
const Rating = require('../models/Rating');
const SOSAlert = require('../models/SOSAlert');
const { protect, driverOnly } = require('../middleware/authMiddleware');

const router = express.Router();

// @route GET /api/drivers/profile
router.get('/profile', protect, driverOnly, async (req, res) => {
  try {
    const driver = await Driver.findById(req.user._id);
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    // Calculate average rating from Rating model
    const ratings = await Rating.find({ driverId: driver._id });
    const averageRating = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
      : 0;

    // Update driver's rating in database
    if (ratings.length > 0) {
      driver.rating = parseFloat(averageRating.toFixed(1));
      await driver.save();
    }

    // Calculate Earnings
    const totalEarningsAgg = await Booking.aggregate([
      { $match: { driverId: driver._id, paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const totalRevenue = totalEarningsAgg[0]?.total || 0;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayEarningsAgg = await Booking.aggregate([
      { 
        $match: { 
          driverId: driver._id, 
          paymentStatus: 'paid',
          updatedAt: { $gte: startOfDay }
        } 
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const todayRevenue = todayEarningsAgg[0]?.total || 0;

    // Driver Share (30%)
    const driverTotalEarnings = Math.round(totalRevenue * 0.3);
    const driverTodayEarnings = Math.round(todayRevenue * 0.3);

    const driverData = driver.toObject();
    driverData.earnings = {
      total: driverTotalEarnings,
      today: driverTodayEarnings
    };

    res.json(driverData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route PATCH /api/drivers/status
router.patch('/status', protect, driverOnly, async (req, res) => {
  try {
    const driver = await Driver.findById(req.user._id);
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    const newStatus = driver.status === 'online' ? 'offline' : 'online';
    driver.status = newStatus;

    // If going online and location provided, update location
    if (newStatus === 'online' && req.body.location) {
      const { lat, lng } = req.body.location;
      driver.location = {
        type: 'Point',
        coordinates: [lng, lat] // GeoJSON format: [longitude, latitude]
      };
    }

    await driver.save();

    res.json({ 
      status: driver.status,
      location: driver.location 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route PATCH /api/drivers/offline
router.patch('/offline', protect, driverOnly, async (req, res) => {
  try {
    const driver = await Driver.findById(req.user._id);
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    driver.status = 'offline';
    await driver.save();

    res.json({ status: 'offline' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route GET /api/drivers/analytics
router.get('/analytics', protect, driverOnly, async (req, res) => {
  try {
    const { period = 'week', startDate, endDate } = req.query;
    const driverId = req.user._id;

    let dateFilter = {};
    const now = new Date();

    if (period === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      dateFilter = { createdAt: { $gte: weekAgo } };
    } else if (period === 'month') {
      const monthAgo = new Date(now);
      monthAgo.setMonth(now.getMonth() - 1);
      dateFilter = { createdAt: { $gte: monthAgo } };
    } else if (period === 'custom' && startDate && endDate) {
      dateFilter = { 
        createdAt: { 
          $gte: new Date(startDate), 
          $lte: new Date(endDate) 
        } 
      };
    }

    // Get completed rides
    const completedRides = await Booking.find({
      driverId,
      status: 'dropped',
      ...dateFilter
    }).sort({ createdAt: -1 });

    // Get all ratings for this driver from Rating model
    const ratings = await Rating.find({ 
      driverId,
      ...(dateFilter.createdAt ? { createdAt: dateFilter.createdAt } : {})
    });

    // Calculate average rating from Rating model
    const averageRating = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
      : 0;

    // Calculate total earnings (assuming driver gets 80% after platform commission)
    const totalEarnings = completedRides.reduce((sum, ride) => {
      const driverShare = ride.driverEarnings || (ride.amount * 0.8);
      return sum + driverShare;
    }, 0);

    // Earnings breakdown by date
    const earningsMap = {};
    completedRides.forEach(ride => {
      const date = new Date(ride.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const earnings = ride.driverEarnings || (ride.amount * 0.8);
      earningsMap[date] = (earningsMap[date] || 0) + earnings;
    });

    const earningsBreakdown = Object.entries(earningsMap).map(([date, earnings]) => ({
      date,
      earnings
    }));

    // Calculate real pending payouts (unpaid completed rides)
    const pendingPayouts = completedRides
      .filter(ride => ride.payoutStatus === 'pending')
      .reduce((sum, ride) => {
        const driverShare = ride.driverEarnings || (ride.amount * 0.8);
        return sum + driverShare;
      }, 0);

    // Get actual payout history (completed payouts)
    const completedPayouts = await Booking.find({
      driverId,
      status: 'dropped',
      payoutStatus: 'completed'
    }).sort({ payoutDate: -1 }).limit(10);

    const payoutHistory = completedPayouts.map(payout => ({
      _id: payout._id,
      date: payout.payoutDate || payout.completedAt,
      amount: payout.driverEarnings || (payout.amount * 0.8),
      method: 'Bank Transfer',
      status: 'completed'
    }));

    res.json({
      totalRides: completedRides.length,
      totalEarnings,
      averageRating,
      completedRides: completedRides.map(ride => ({
        _id: ride._id,
        createdAt: ride.createdAt,
        pickupAddress: ride.pickupAddress,
        dropAddress: ride.dropAddress,
        distance: ride.distance,
        distanceKm: ride.distanceKm,
        amount: ride.amount,
        fare: ride.fare,
        driverEarnings: ride.driverEarnings || (ride.amount * 0.8),
        platformCommission: ride.platformCommission || (ride.amount * 0.2),
        status: ride.status,
        rating: ride.rating
      })),
      earningsBreakdown,
      pendingPayouts,
      payoutHistory
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route POST /api/drivers/sos
router.post('/sos', protect, driverOnly, async (req, res) => {
  try {
    const driver = await Driver.findById(req.user._id);
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    // Convert location from {lat, lng} to GeoJSON format
    let locationData = {
      type: 'Point',
      coordinates: [0, 0]
    };

    if (req.body.location) {
      const { lat, lng } = req.body.location;
      locationData = {
        type: 'Point',
        coordinates: [lng, lat] // MongoDB uses [longitude, latitude]
      };
    } else if (driver.location) {
      locationData = driver.location;
    }

    const sosAlert = new SOSAlert({
      driverId: driver._id,
      message: req.body.message || 'Emergency alert sent',
      location: locationData,
      status: 'active'
    });

    await sosAlert.save();

    // Populate driver details for socket emission
    await sosAlert.populate('driverId', 'name email phone vehicleNumber');

    console.log('SOS Alert Created:', {
      id: sosAlert._id,
      driver: sosAlert.driverId.name,
      message: sosAlert.message
    });

    // Emit socket event to notify admin in real-time
    if (req.io) {
      const location = sosAlert.location?.coordinates 
        ? { lat: sosAlert.location.coordinates[1], lng: sosAlert.location.coordinates[0] }
        : null;

      const alertData = {
        _id: sosAlert._id,
        driverId: {
          _id: sosAlert.driverId._id,
          name: sosAlert.driverId.name,
          phone: sosAlert.driverId.phone,
          vehicleNumber: sosAlert.driverId.vehicleNumber
        },
        driverName: sosAlert.driverId.name,
        driverPhone: sosAlert.driverId.phone,
        message: sosAlert.message,
        location: location,
        createdAt: sosAlert.createdAt,
        status: sosAlert.status,
        resolvedAt: null
      };

      console.log('Emitting SOS alert via socket.io:', alertData);
      req.io.emit('sos_alert', alertData);
      console.log('Socket emission completed');
    } else {
      console.log('ERROR: req.io is not available!');
    }

    res.json({ 
      message: 'SOS alert sent successfully',
      alertId: sosAlert._id 
    });
  } catch (error) {
    console.error('SOS error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route GET /api/drivers/feedback
router.get('/feedback', protect, driverOnly, async (req, res) => {
  try {
    const driverId = req.user._id;

    // Get all ratings for this driver from the Rating model
    const ratings = await Rating.find({ driverId })
      .populate('reviewerId', 'name email')
      .populate('bookingId', 'pickupAddress dropAddress amount createdAt completedAt')
      .sort({ createdAt: -1 });

    const feedbackList = ratings.map(rating => ({
      _id: rating._id,
      patientName: rating.reviewerId?.name || 'Anonymous',
      rating: rating.rating,
      comment: rating.comment,
      reply: rating.driverReply,
      createdAt: rating.createdAt,
      bookingDetails: {
        pickupAddress: rating.bookingId?.pickupAddress || 'N/A',
        dropAddress: rating.bookingId?.dropAddress || 'N/A',
        amount: rating.bookingId?.amount || 0
      }
    }));

    res.json(feedbackList);
  } catch (error) {
    console.error('Feedback fetch error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route POST /api/drivers/feedback/:feedbackId/reply
router.post('/feedback/:feedbackId/reply', protect, driverOnly, async (req, res) => {
  try {
    const { feedbackId } = req.params;
    const { reply } = req.body;
    const driverId = req.user._id;

    if (!reply || !reply.trim()) {
      return res.status(400).json({ message: 'Reply text is required' });
    }

    // Find the rating by the driver
    const rating = await Rating.findOne({
      _id: feedbackId,
      driverId
    });

    if (!rating) {
      return res.status(404).json({ message: 'Feedback not found or unauthorized' });
    }

    rating.driverReply = reply.trim();
    rating.repliedAt = new Date();
    await rating.save();

    res.json({ 
      message: 'Reply sent successfully',
      reply: rating.driverReply 
    });
  } catch (error) {
    console.error('Reply error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
