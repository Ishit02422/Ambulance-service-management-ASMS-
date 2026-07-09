const express = require('express');
const Patient = require('../models/Patient');
const Driver = require('../models/Driver');
const DriverDocument = require('../models/DriverDocument');
const Booking = require('../models/Booking');
const Rating = require('../models/Rating');
const SOSAlert = require('../models/SOSAlert');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { sendDriverApprovalEmail, sendDriverRejectionEmail } = require('../utils/emailService');
const { rotateSecret, getSecretInfo } = require('../utils/jwtManager');

const router = express.Router();

// dashboard stats
router.get('/stats', protect, adminOnly, async (req, res) => {
  try {
    const totalPatients = await Patient.countDocuments({ role: 'patient' });
    const totalDrivers = await Driver.countDocuments({});
    const totalBookings = await Booking.countDocuments();
    
    // Total Revenue (All time)
    const totalRevenueAgg = await Booking.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const totalRevenue = totalRevenueAgg[0]?.total || 0;

    // Today's Revenue
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const todayRevenueAgg = await Booking.aggregate([
      { 
        $match: { 
          paymentStatus: 'paid',
          updatedAt: { $gte: startOfDay }
        } 
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const todayRevenue = todayRevenueAgg[0]?.total || 0;

    // Admin Shares (70%)
    const adminTotalRevenue = Math.round(totalRevenue * 0.7);
    const adminTodayRevenue = Math.round(todayRevenue * 0.7);

    res.json({ 
      totalPatients, 
      totalDrivers, 
      totalBookings, 
      totalRevenue, 
      adminTotalRevenue,
      adminTodayRevenue
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// get pending drivers for verification
router.get('/drivers/pending', protect, adminOnly, async (req, res) => {
  try {
    const drivers = await Driver.find({ isApproved: false }).populate('documents');
    res.json(drivers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// get all drivers (approved) with status
router.get('/drivers/all', protect, adminOnly, async (req, res) => {
  try {
    const drivers = await Driver.find({ isApproved: true });
    res.json(drivers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// get all patients
router.get('/patients', protect, adminOnly, async (req, res) => {
  try {
    const patients = await Patient.find({ role: 'patient' });
    res.json(patients);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// approve / reject driver
router.patch('/drivers/:id/verify', protect, adminOnly, async (req, res) => {
  try {
    console.log('Verify driver request body:', req.body);
    const { isVerified, reason } = req.body;
    const driver = await Driver.findById(req.params.id);

    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    if (isVerified) {
      driver.isApproved = true;
      await driver.save();
      console.log(`Driver ${driver._id} approved`);
      
      console.log(`Sending approval email to ${driver.email}`);
      await sendDriverApprovalEmail(driver.email, driver.name);
      
      res.json({ message: 'Driver approved successfully' });
    } else {
      // If rejecting, we might want to delete the driver or just mark as rejected/not approved
      // For now, let's keep them but maybe add a status field or just keep isApproved false
      // But the user wants to send a reason.
      
      // If we want to allow them to re-apply, maybe we should delete them? 
      // Or just keep them as unapproved. The prompt implies "reject", which usually means "No".
      // Let's assume we just send the email and keep isApproved = false.
      
      // However, if they need to "register again" as per my email template, maybe we should delete?
      // Or maybe they can login and see "Rejected"?
      // Let's stick to sending the email for now.
      
      console.log(`Driver ${driver._id} rejected. Reason: ${reason}`);
      
      // Send rejection email
      await sendDriverRejectionEmail(driver.email, driver.name, reason || 'Documents verification failed');
      
      // Delete the driver and their documents so they can register again
      await DriverDocument.deleteMany({ driverId: driver._id });
      await Driver.findByIdAndDelete(driver._id);
      
      res.json({ message: 'Driver rejected and removed' });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// get all bookings with filters
router.get('/bookings', protect, adminOnly, async (req, res) => {
  try {
    const { status, startDate, endDate, search } = req.query;
    
    let matchStage = {};

    // Status Filter
    if (status && status !== 'all') {
      matchStage.status = status;
    }

    // Date Range Filter
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        matchStage.createdAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchStage.createdAt.$lte = end;
      }
    }

    // Aggregation Pipeline
    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'patients',
          localField: 'patientId',
          foreignField: '_id',
          as: 'patient'
        }
      },
      { $unwind: { path: '$patient', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'drivers',
          localField: 'driverId',
          foreignField: '_id',
          as: 'driver'
        }
      },
      { $unwind: { path: '$driver', preserveNullAndEmptyArrays: true } },
      { $sort: { createdAt: -1 } }
    ];

    // Search Filter (Applied after lookups)
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      pipeline.push({
        $match: {
          $or: [
            { 'patient.name': searchRegex },
            { 'driver.name': searchRegex },
            { 'bookingId': searchRegex },
            { 'pickupAddress': searchRegex },
            { 'dropAddress': searchRegex }
          ]
        }
      });
    }

    // Project fields to match expected output structure (renaming joined fields back to original names if needed, or just keeping them)
    // The frontend expects patientId.name, driverId.name. 
    // After lookup/unwind, 'patient' is an object. We can project it back to 'patientId' or update frontend.
    // Easier to project back to match Mongoose populate structure roughly.
    pipeline.push({
      $project: {
        _id: 1,
        bookingId: 1,
        ambulanceType: 1,
        pickupAddress: 1,
        dropAddress: 1,
        status: 1,
        amount: 1,
        fare: 1,
        distance: 1,
        createdAt: 1,
        paymentStatus: 1,
        patientId: '$patient', // Map back to patientId for frontend compatibility
        driverId: '$driver'    // Map back to driverId for frontend compatibility
      }
    });

    const bookings = await Booking.aggregate(pipeline);

    res.json(bookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// get chart data (last 7 days daily + last 6 months revenue)
router.get('/stats/charts', protect, adminOnly, async (req, res) => {
  try {
    // 1. Daily Stats (Last 7 Days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const dailyBookings = await Booking.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
          revenue: { 
            $sum: { 
              $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$amount", 0] 
            } 
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const dailyStats = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      const existing = dailyBookings.find(b => b._id === dateStr);
      if (existing) {
        dailyStats.unshift(existing);
      } else {
        dailyStats.unshift({ _id: dateStr, count: 0, revenue: 0 });
      }
    }

    // 2. Monthly Revenue (Last 6 Months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const monthlyRevenueAgg = await Booking.aggregate([
      { 
        $match: { 
          createdAt: { $gte: sixMonthsAgo },
          paymentStatus: 'paid'
        } 
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          revenue: { $sum: "$amount" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const monthlyStats = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthStr = d.toISOString().slice(0, 7); // YYYY-MM
      
      const existing = monthlyRevenueAgg.find(m => m._id === monthStr);
      if (existing) {
        monthlyStats.unshift(existing);
      } else {
        monthlyStats.unshift({ _id: monthStr, revenue: 0 });
      }
    }

    res.json({ dailyStats, monthlyStats });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all feedbacks
router.get('/feedbacks', protect, adminOnly, async (req, res) => {
  try {
    const feedbacks = await Rating.find()
      .populate('reviewerId', 'name email')
      .populate('driverId', 'name email')
      .populate('bookingId', 'pickupAddress dropAddress')
      .sort({ createdAt: -1 });
    res.json(feedbacks);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching feedbacks', error: error.message });
  }
});

// Get all SOS alerts
router.get('/sos-alerts', protect, adminOnly, async (req, res) => {
  try {
    const alerts = await SOSAlert.find()
      .populate('driverId', 'name email phone vehicleNumber')
      .sort({ createdAt: -1 });
    
    // Transform the data to include location in lat/lng format
    const transformedAlerts = alerts.map(alert => ({
      _id: alert._id,
      driverId: alert.driverId,
      message: alert.message,
      location: alert.location?.coordinates 
        ? { lat: alert.location.coordinates[1], lng: alert.location.coordinates[0] }
        : null,
      status: alert.status,
      resolvedAt: alert.resolvedAt,
      resolvedBy: alert.resolvedBy,
      createdAt: alert.createdAt,
      updatedAt: alert.updatedAt
    }));
    
    res.json(transformedAlerts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching SOS alerts', error: error.message });
  }
});

// Mark SOS alert as resolved
router.patch('/sos-alerts/:id/resolve', protect, adminOnly, async (req, res) => {
  try {
    const alert = await SOSAlert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({ message: 'SOS alert not found' });
    }
    
    alert.resolvedAt = new Date();
    alert.resolvedBy = req.user._id;
    await alert.save();
    
    res.json({ message: 'SOS alert resolved successfully', alert });
  } catch (error) {
    res.status(500).json({ message: 'Error resolving SOS alert', error: error.message });
  }
});

// @route   POST /api/admin/security/rotate-jwt-secret
// @desc    Manually rotate JWT secret (admin only)
// @access  Private (Admin)
router.post('/security/rotate-jwt-secret', protect, adminOnly, async (req, res) => {
  try {
    const result = rotateSecret();
    res.json({
      message: 'JWT secret rotated successfully',
      ...result,
      warning: 'Users will need to re-login within 7 days as old tokens expire'
    });
  } catch (error) {
    console.error('Error rotating JWT secret:', error);
    res.status(500).json({ message: 'Failed to rotate JWT secret' });
  }
});

// @route   GET /api/admin/security/jwt-info
// @desc    Get JWT secret rotation info (admin only)
// @access  Private (Admin)
router.get('/security/jwt-info', protect, adminOnly, async (req, res) => {
  try {
    const info = getSecretInfo();
    res.json(info);
  } catch (error) {
    console.error('Error getting JWT info:', error);
    res.status(500).json({ message: 'Failed to get JWT info' });
  }
});

// ============= PAYMENT RECONCILIATION DASHBOARD =============
// Get payment statistics
router.get('/payments/stats', protect, adminOnly, async (req, res) => {
  try {
    const { period = 'today' } = req.query;
    
    let startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    
    if (period === 'week') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === 'month') {
      startDate.setMonth(startDate.getMonth() - 1);
    } else if (period === 'year') {
      startDate.setFullYear(startDate.getFullYear() - 1);
    }

    const stats = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$paymentStatus',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    const refundStats = await Booking.aggregate([
      {
        $match: {
          refundStatus: { $in: ['pending', 'processed'] },
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$refundStatus',
          count: { $sum: 1 },
          totalAmount: { $sum: '$refundAmount' }
        }
      }
    ]);

    res.json({
      success: true,
      period,
      payments: stats,
      refunds: refundStats,
      summary: {
        totalTransactions: stats.reduce((sum, s) => sum + s.count, 0),
        totalRevenue: stats.find(s => s._id === 'paid')?.totalAmount || 0,
        pendingAmount: stats.find(s => s._id === 'pending')?.totalAmount || 0,
        failedCount: stats.find(s => s._id === 'failed')?.count || 0,
        refundsPending: refundStats.find(s => s._id === 'pending')?.totalAmount || 0,
        refundsProcessed: refundStats.find(s => s._id === 'processed')?.totalAmount || 0
      }
    });
  } catch (error) {
    console.error('Error fetching payment stats:', error);
    res.status(500).json({ message: 'Failed to fetch payment stats' });
  }
});

// Get failed payments for review
router.get('/payments/failed', protect, adminOnly, async (req, res) => {
  try {
    const failedPayments = await Booking.find({
      paymentStatus: 'failed'
    })
    .populate('patientId', 'name email phone')
    .sort({ createdAt: -1 })
    .limit(50);

    res.json({
      success: true,
      count: failedPayments.length,
      payments: failedPayments.map(b => ({
        bookingId: b._id,
        patient: {
          name: b.patientId?.name,
          email: b.patientId?.email,
          phone: b.patientId?.phone
        },
        amount: b.amount,
        failureReason: b.paymentFailureReason,
        retryCount: b.paymentRetryCount || 0,
        createdAt: b.createdAt,
        status: b.status
      }))
    });
  } catch (error) {
    console.error('Error fetching failed payments:', error);
    res.status(500).json({ message: 'Failed to fetch failed payments' });
  }
});

// Get pending refunds
router.get('/payments/refunds/pending', protect, adminOnly, async (req, res) => {
  try {
    const pendingRefunds = await Booking.find({
      refundStatus: 'pending'
    })
    .populate('patientId', 'name email phone')
    .sort({ refundInitiatedAt: -1 });

    res.json({
      success: true,
      count: pendingRefunds.length,
      refunds: pendingRefunds.map(b => ({
        bookingId: b._id,
        patient: {
          name: b.patientId?.name,
          email: b.patientId?.email,
          phone: b.patientId?.phone
        },
        amount: b.amount,
        refundAmount: b.refundAmount,
        refundPercent: b.refundPercent,
        refundReason: b.refundReason,
        razorpayRefundId: b.razorpayRefundId,
        initiatedAt: b.refundInitiatedAt,
        status: b.status
      }))
    });
  } catch (error) {
    console.error('Error fetching pending refunds:', error);
    res.status(500).json({ message: 'Failed to fetch pending refunds' });
  }
});

module.exports = router;
