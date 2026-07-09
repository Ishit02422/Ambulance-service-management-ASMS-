const express = require('express');
const Booking = require('../models/Booking');
const Rating = require('../models/Rating');
const Driver = require('../models/Driver');
const Settings = require('../models/Settings');
const { protect, driverOnly, adminOnly } = require('../middleware/authMiddleware');
const { 
  createBookingValidation, 
  updateBookingStatusValidation, 
  cancelBookingValidation, 
  feedbackValidation,
  mongoIdValidation 
} = require('../middleware/validators');

const router = express.Router();

// patient: create new booking
router.post('/', protect, createBookingValidation, async (req, res) => {
  try {
    const { ambulanceType, pickupLocation, dropLocation, distanceKm, paymentMethod, paymentStatus } = req.body;

    // Fetch settings for fare calculation
    let settings = await Settings.findOne();
    if (!settings) {
      // Fallback defaults if no settings exist
      settings = {
        fareRates: {
          normal: { base: 200, perKm: 15 },
          icu: { base: 500, perKm: 30 },
          cardiac: { base: 600, perKm: 35 },
          dead_body_van: { base: 300, perKm: 20 }
        }
      };
    }

    const rates = settings.fareRates[ambulanceType] || settings.fareRates.normal;
    const calculatedFare = Math.round(rates.base + (rates.perKm * distanceKm));

    const booking = await Booking.create({
      bookingId: 'BK' + Date.now() + Math.floor(Math.random() * 1000),
      patientId: req.user._id,
      ambulanceType,
      pickupLocation: {
        type: 'Point',
        coordinates: [pickupLocation.lng, pickupLocation.lat]
      },
      pickupAddress: pickupLocation.address,
      dropLocation: {
        type: 'Point',
        coordinates: [dropLocation.lng, dropLocation.lat]
      },
      dropAddress: dropLocation.address,
      distance: distanceKm,
      amount: calculatedFare,
      status: 'requested',
      paymentStatus: paymentStatus || 'pending',
      paymentMethod: paymentMethod || 'cash'
    });

    // Notify all drivers
    req.io.to('drivers').emit('new_booking', booking);

    res.status(201).json(booking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// patient: get own bookings
router.get('/my', protect, async (req, res) => {
  try {
    const bookings = await Booking.find({ patientId: req.user._id })
      .populate('driverId', 'name phone vehicleNumber ambulanceType rating')
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// driver: get available bookings (pending and matching type)
router.get('/available', protect, driverOnly, async (req, res) => {
  try {
    // In a real app, we would filter by location and ambulance type
    // For now, just return all pending bookings
    const bookings = await Booking.find({ 
      status: 'requested', 
      driverId: null 
    }).sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// driver: accept booking
router.patch('/:id/accept', protect, driverOnly, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (booking.driverId) {
      return res.status(400).json({ message: 'Booking already assigned' });
    }

    booking.driverId = req.user._id;
    booking.status = 'accepted';
    await booking.save();

    // Populate driver info to send to patient
    await booking.populate('driverId', 'name phone vehicleNumber ambulanceType rating');

    // Notify patient
    req.io.to(`patient_${booking.patientId}`).emit('booking_accepted', booking);

    res.json(booking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// driver: get assigned bookings
router.get('/driver', protect, driverOnly, async (req, res) => {
  try {
    const bookings = await Booking.find({ driverId: req.user._id }).sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// driver: update status
router.patch('/:id/status', protect, driverOnly, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const newStatus = req.body.status || booking.status;
    booking.status = newStatus;
    
    // If ride is completed/dropped, calculate driver earnings and commission
    if (newStatus === 'dropped' && !booking.completedAt) {
      booking.completedAt = new Date();
      
      // Get platform commission from settings (default 20%)
      const Settings = require('../models/Settings');
      const settings = await Settings.findOne();
      const commissionPercent = settings?.commission?.platformPercent || 20;
      
      // Calculate earnings
      const totalAmount = booking.amount || booking.estimatedAmount;
      booking.platformCommission = totalAmount * (commissionPercent / 100);
      booking.driverEarnings = totalAmount - booking.platformCommission;
      booking.payoutStatus = 'pending'; // Mark as pending payout
    }
    
    await booking.save();
    
    // Notify patient of status change
    req.io.to(`patient_${booking.patientId}`).emit('booking_updated', booking);

    res.json(booking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// patient: make payment
router.patch('/:id/pay', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Verify user owns this booking
    if (booking.patientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    booking.paymentStatus = 'paid';
    booking.paymentMethod = req.body.paymentMethod || 'cash';
    await booking.save();

    res.json(booking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// patient: cancel booking
router.patch('/:id/cancel', protect, async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Verify user owns this booking
    if (booking.patientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Check if booking can be cancelled
    if (!['requested', 'pending', 'accepted', 'on_the_way'].includes(booking.status)) {
      return res.status(400).json({ message: 'Booking cannot be cancelled at this stage' });
    }

    // Calculate refund based on status
    let refundPercent = 0;
    if (booking.status === 'requested' || booking.status === 'pending') {
      refundPercent = 100; // Full refund if not yet accepted
    } else if (booking.status === 'accepted' || booking.status === 'on_the_way') {
      refundPercent = 50; // 50% refund if driver accepted
    }

    booking.status = 'cancelled';
    booking.cancellationReason = reason;
    booking.cancelledAt = new Date();
    booking.cancelledBy = 'patient';
    booking.refundAmount = Math.round((booking.amount * refundPercent) / 100);
    booking.refundPercent = refundPercent;
    
    await booking.save();

    // Notify driver if assigned
    if (booking.driverId) {
      req.io.to(`driver_${booking.driverId}`).emit('booking_cancelled', {
        bookingId: booking._id,
        reason
      });
    }

    res.json({ 
      message: 'Booking cancelled successfully',
      refundAmount: booking.refundAmount,
      refundPercent: booking.refundPercent,
      booking 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// patient: submit feedback
router.post('/:id/feedback', protect, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Verify user owns this booking
    if (booking.patientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Create rating
    await Rating.create({
      bookingId: booking._id,
      reviewerId: req.user._id,
      driverId: booking.driverId,
      rating,
      comment
    });

    // Update driver's average rating
    const ratings = await Rating.find({ driverId: booking.driverId });
    const avgRating = ratings.reduce((acc, curr) => acc + curr.rating, 0) / ratings.length;

    await Driver.findByIdAndUpdate(booking.driverId, {
      rating: parseFloat(avgRating.toFixed(1))
    });

    res.status(201).json({ message: 'Feedback submitted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// admin: get all bookings
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('patientId', 'name email')
      .populate('driverId', 'name email')
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
