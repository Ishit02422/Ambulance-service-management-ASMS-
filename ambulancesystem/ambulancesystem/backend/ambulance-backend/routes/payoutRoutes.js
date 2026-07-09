const express = require('express');
const Payout = require('../models/Payout');
const Booking = require('../models/Booking');
const Driver = require('../models/Driver');
const { protect, driverOnly, adminOnly } = require('../middleware/authMiddleware');
const { processDailyPayoutsNow } = require('../utils/payoutScheduler');

const router = express.Router();

// @route   GET /api/payouts/driver
// @desc    Get driver's payout history and pending earnings
// @access  Private (Driver)
router.get('/driver', protect, driverOnly, async (req, res) => {
  try {
    // Get payout history
    const payouts = await Payout.find({ driverId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    // Calculate pending earnings (completed rides not yet in payout)
    const pendingBookings = await Booking.find({
      driverId: req.user._id,
      status: 'dropped',
      paymentStatus: 'paid',
      payoutStatus: 'pending'
    }).sort({ completedAt: -1 });

    const pendingEarnings = pendingBookings.reduce((sum, booking) => {
      return sum + (booking.driverEarnings || 0);
    }, 0);

    const pendingRideCount = pendingBookings.length;

    // Group pending bookings by day
    const dayWisePayouts = {};
    pendingBookings.forEach(booking => {
      const date = new Date(booking.completedAt).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
      
      if (!dayWisePayouts[date]) {
        dayWisePayouts[date] = {
          date: date,
          rides: [],
          totalAmount: 0,
          rideCount: 0
        };
      }
      
      const earnings = booking.driverEarnings || 0;
      dayWisePayouts[date].rides.push({
        bookingId: booking.bookingId,
        amount: earnings,
        completedAt: booking.completedAt,
        pickupAddress: booking.pickupAddress,
        dropAddress: booking.dropAddress
      });
      dayWisePayouts[date].totalAmount += earnings;
      dayWisePayouts[date].rideCount += 1;
    });

    // Convert to array and sort by date (newest first)
    const pendingPayoutsByDay = Object.values(dayWisePayouts).sort((a, b) => 
      new Date(b.date) - new Date(a.date)
    );

    // Get total earnings stats
    const totalEarnings = await Payout.aggregate([
      { $match: { driverId: req.user._id, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    res.json({
      payouts,
      pendingEarnings,
      pendingRideCount,
      totalEarnings: totalEarnings[0]?.total || 0,
      pendingPayoutsByDay: pendingPayoutsByDay
    });
  } catch (error) {
    console.error('Error fetching driver payouts:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/payouts/admin
// @desc    Get all payouts for admin
// @access  Private (Admin)
router.get('/admin', protect, adminOnly, async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;
    
    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }
    if (startDate || endDate) {
      query.payoutDate = {};
      if (startDate) query.payoutDate.$gte = new Date(startDate);
      if (endDate) query.payoutDate.$lte = new Date(endDate);
    }

    const payouts = await Payout.find(query)
      .populate('driverId', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(200);

    // Get summary stats
    const stats = await Payout.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    res.json({ payouts, stats });
  } catch (error) {
    console.error('Error fetching admin payouts:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PATCH /api/payouts/:id/complete
// @desc    Mark payout as completed (admin only)
// @access  Private (Admin)
router.patch('/:id/complete', protect, adminOnly, async (req, res) => {
  try {
    const { transactionId, notes } = req.body;

    const payout = await Payout.findById(req.params.id);
    if (!payout) {
      return res.status(404).json({ message: 'Payout not found' });
    }

    if (payout.status === 'completed') {
      return res.status(400).json({ message: 'Payout already completed' });
    }

    payout.status = 'completed';
    payout.transactionId = transactionId;
    payout.notes = notes;
    payout.completedAt = new Date();
    payout.processedBy = req.user.id;
    await payout.save();

    // Update all associated bookings
    await Booking.updateMany(
      { _id: { $in: payout.bookingIds } },
      { payoutStatus: 'completed' }
    );

    res.json({ message: 'Payout marked as completed', payout });
  } catch (error) {
    console.error('Error completing payout:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PATCH /api/payouts/:id/fail
// @desc    Mark payout as failed (admin only)
// @access  Private (Admin)
router.patch('/:id/fail', protect, adminOnly, async (req, res) => {
  try {
    const { failureReason } = req.body;

    const payout = await Payout.findById(req.params.id);
    if (!payout) {
      return res.status(404).json({ message: 'Payout not found' });
    }

    payout.status = 'failed';
    payout.failureReason = failureReason;
    payout.processedBy = req.user.id;
    await payout.save();

    // Revert bookings back to pending
    await Booking.updateMany(
      { _id: { $in: payout.bookingIds } },
      { payoutStatus: 'pending', payoutDate: null }
    );

    res.json({ message: 'Payout marked as failed', payout });
  } catch (error) {
    console.error('Error failing payout:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/payouts/admin/trigger
// @desc    Manually trigger payout processing (admin only)
// @access  Private (Admin)
router.post('/admin/trigger', protect, adminOnly, async (req, res) => {
  try {
    const results = await processDailyPayoutsNow();
    res.json({ 
      message: 'Payout processing triggered successfully',
      processed: results.length,
      results 
    });
  } catch (error) {
    console.error('Error triggering payouts:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/payouts/stats
// @desc    Get payout statistics for admin
// @access  Private (Admin)
router.get('/stats', protect, adminOnly, async (req, res) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const stats = {
      pending: await Payout.countDocuments({ status: 'pending' }),
      processing: await Payout.countDocuments({ status: 'processing' }),
      completed: await Payout.countDocuments({ status: 'completed' }),
      failed: await Payout.countDocuments({ status: 'failed' }),
      
      thisMonth: await Payout.aggregate([
        { $match: { createdAt: { $gte: startOfMonth }, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      
      totalPaidOut: await Payout.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    };

    res.json({
      pending: stats.pending,
      processing: stats.processing,
      completed: stats.completed,
      failed: stats.failed,
      thisMonthAmount: stats.thisMonth[0]?.total || 0,
      thisMonthCount: stats.thisMonth[0]?.count || 0,
      totalPaidOut: stats.totalPaidOut[0]?.total || 0
    });
  } catch (error) {
    console.error('Error fetching payout stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
