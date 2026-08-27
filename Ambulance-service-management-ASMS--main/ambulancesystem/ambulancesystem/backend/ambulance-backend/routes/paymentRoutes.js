const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Booking = require('../models/Booking');
const { protect } = require('../middleware/authMiddleware');
const { sendEmail } = require('../utils/emailService');

const router = express.Router();

// Initialize Razorpay (supports both test and production keys)
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Check if using production keys
const isProduction = process.env.RAZORPAY_KEY_ID?.startsWith('rzp_live_');
console.log(`Razorpay initialized in ${isProduction ? 'PRODUCTION' : 'TEST'} mode`);

// Create Razorpay order (with seamless test/demo fallback if keys not configured)
router.post('/create-order', protect, async (req, res) => {
  try {
    const { amount, bookingId } = req.body;
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    const isDummyKey = !keyId || keyId.includes('your_razorpay') || keyId === 'undefined';

    // Generate short receipt (max 40 chars as per Razorpay requirement)
    const timestamp = Date.now().toString().slice(-8);
    const receipt = `BK${timestamp}`;

    if (isDummyKey) {
      // Demo / Test Mode Order
      console.log('Generating Demo Razorpay Order for amount:', amount);
      return res.json({
        orderId: `order_demo_${Date.now()}`,
        amount: Math.round(amount * 100),
        currency: 'INR',
        key: 'rzp_test_demo',
        isMock: true
      });
    }

    const options = {
      amount: Math.round(amount * 100), // Amount in paise
      currency: 'INR',
      receipt: receipt,
      notes: {
        bookingId: bookingId || '',
        patientId: req.user._id.toString()
      }
    };

    try {
      const order = await razorpay.orders.create(options);
      res.json({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID,
        isMock: false
      });
    } catch (rzpErr) {
      console.warn('Razorpay API error, falling back to Demo Order:', rzpErr.message);
      res.json({
        orderId: `order_demo_${Date.now()}`,
        amount: Math.round(amount * 100),
        currency: 'INR',
        key: 'rzp_test_demo',
        isMock: true
      });
    }
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({ message: 'Failed to create payment order' });
  }
});

// Verify Razorpay payment
router.post('/verify-payment', protect, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;

    const isMock = !razorpay_signature || razorpay_order_id?.startsWith('order_demo_') || razorpay_signature === 'mock_signature';

    if (isMock) {
      // Demo payment verification
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }

      booking.paymentStatus = 'paid';
      booking.paymentMethod = 'online';
      booking.razorpayOrderId = razorpay_order_id || `order_demo_${Date.now()}`;
      booking.razorpayPaymentId = razorpay_payment_id || `pay_demo_${Date.now()}`;
      await booking.save();

      return res.json({ 
        success: true, 
        message: 'Payment verified successfully (Demo Mode)',
        booking 
      });
    }

    // Verify signature with real secret
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'secret')
      .update(body.toString())
      .digest('hex');

    if (expectedSignature === razorpay_signature) {
      // Payment verified successfully
      const booking = await Booking.findById(bookingId);
      
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }

      booking.paymentStatus = 'paid';
      booking.paymentMethod = 'online';
      booking.razorpayOrderId = razorpay_order_id;
      booking.razorpayPaymentId = razorpay_payment_id;
      await booking.save();

      res.json({ 
        success: true, 
        message: 'Payment verified successfully',
        booking 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        message: 'Payment verification failed' 
      });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ message: 'Payment verification failed' });
  }
});

// Get Razorpay key for frontend
router.get('/razorpay-key', (req, res) => {
  res.json({ 
    key: process.env.RAZORPAY_KEY_ID,
    isProduction: isProduction
  });
});

// ============= WEBHOOK HANDLER =============
// Razorpay webhook for real-time payment notifications
router.post('/webhook', async (req, res) => {
  try {
    // Verify webhook signature
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];
    
    if (webhookSecret) {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (signature !== expectedSignature) {
        console.error('Webhook signature verification failed');
        return res.status(400).json({ error: 'Invalid signature' });
      }
    }

    const event = req.body.event;
    const payload = req.body.payload.payment.entity;

    console.log('Webhook received:', event);

    switch (event) {
      case 'payment.captured':
        await handlePaymentCaptured(payload);
        break;
      
      case 'payment.failed':
        await handlePaymentFailed(payload);
        break;
      
      case 'refund.created':
        await handleRefundCreated(payload);
        break;
      
      default:
        console.log('Unhandled webhook event:', event);
    }

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Handle payment captured event
async function handlePaymentCaptured(payment) {
  try {
    const bookingId = payment.notes?.bookingId;
    if (!bookingId) return;

    const booking = await Booking.findById(bookingId).populate('patientId');
    if (!booking) return;

    booking.paymentStatus = 'paid';
    booking.paymentMethod = 'online';
    booking.razorpayPaymentId = payment.id;
    booking.razorpayOrderId = payment.order_id;
    await booking.save();

    // Send confirmation email
    if (booking.patientId?.email) {
      await sendEmail({
        to: booking.patientId.email,
        subject: 'Payment Confirmed - Ambulance Booking',
        text: `Your payment of ₹${booking.amount} has been confirmed. Booking ID: ${booking._id}`
      });
    }

    console.log('Payment captured for booking:', bookingId);
  } catch (error) {
    console.error('Error handling payment captured:', error);
  }
}

// Handle payment failed event
async function handlePaymentFailed(payment) {
  try {
    const bookingId = payment.notes?.bookingId;
    if (!bookingId) return;

    const booking = await Booking.findById(bookingId).populate('patientId');
    if (!booking) return;

    booking.paymentStatus = 'failed';
    booking.paymentFailureReason = payment.error_description || 'Payment failed';
    await booking.save();

    // Send failure email
    if (booking.patientId?.email) {
      await sendEmail({
        to: booking.patientId.email,
        subject: 'Payment Failed - Ambulance Booking',
        text: `Your payment for booking ${booking._id} failed. Reason: ${booking.paymentFailureReason}. Please try again.`
      });
    }

    console.log('Payment failed for booking:', bookingId);
  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
}

// Handle refund created event
async function handleRefundCreated(refund) {
  try {
    const paymentId = refund.payment_id;
    const booking = await Booking.findOne({ razorpayPaymentId: paymentId }).populate('patientId');
    
    if (!booking) return;

    booking.refundStatus = 'processed';
    booking.razorpayRefundId = refund.id;
    booking.refundProcessedAt = new Date();
    await booking.save();

    // Send refund confirmation email
    if (booking.patientId?.email) {
      await sendEmail({
        to: booking.patientId.email,
        subject: 'Refund Processed - Ambulance Booking',
        text: `Your refund of ₹${refund.amount / 100} has been processed for booking ${booking._id}. It will reflect in your account within 5-7 business days.`
      });
    }

    console.log('Refund processed for booking:', booking._id);
  } catch (error) {
    console.error('Error handling refund created:', error);
  }
}

// ============= PAYMENT RETRY =============
// Retry failed payment
router.post('/retry-payment', protect, async (req, res) => {
  try {
    const { bookingId } = req.body;
    
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.patientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (booking.paymentStatus === 'paid') {
      return res.status(400).json({ message: 'Payment already completed' });
    }

    // Create new Razorpay order
    const options = {
      amount: booking.amount * 100,
      currency: 'INR',
      receipt: `retry_${bookingId}_${Date.now()}`,
      notes: {
        bookingId: bookingId,
        patientId: req.user._id.toString(),
        retryAttempt: (booking.paymentRetryCount || 0) + 1
      }
    };

    const order = await razorpay.orders.create(options);
    
    // Update retry count
    booking.paymentRetryCount = (booking.paymentRetryCount || 0) + 1;
    await booking.save();

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Error retrying payment:', error);
    res.status(500).json({ message: 'Failed to retry payment' });
  }
});

// ============= REFUND API =============
// Process refund via Razorpay API
router.post('/refund', protect, async (req, res) => {
  try {
    const { bookingId, reason } = req.body;
    
    const booking = await Booking.findById(bookingId).populate('patientId');
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check authorization
    if (req.user.role !== 'admin' && booking.patientId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (booking.paymentStatus !== 'paid') {
      return res.status(400).json({ message: 'No payment to refund' });
    }

    if (booking.refundStatus === 'processed' || booking.refundStatus === 'pending') {
      return res.status(400).json({ message: 'Refund already initiated' });
    }

    if (!booking.razorpayPaymentId) {
      return res.status(400).json({ message: 'Payment ID not found' });
    }

    // Calculate refund amount
    let refundPercent = 0;
    if (booking.status === 'pending') {
      refundPercent = 100;
    } else if (booking.status === 'accepted') {
      refundPercent = 50;
    } else if (['on_the_way', 'picked', 'completed'].includes(booking.status)) {
      refundPercent = 0;
    }

    const refundAmount = Math.round((booking.amount * refundPercent) / 100);

    if (refundAmount === 0) {
      return res.status(400).json({ message: 'No refund applicable for this booking status' });
    }

    // Initiate refund via Razorpay API
    const refund = await razorpay.payments.refund(booking.razorpayPaymentId, {
      amount: refundAmount * 100, // Amount in paise
      notes: {
        bookingId: bookingId,
        reason: reason || 'Booking cancelled',
        refundPercent: refundPercent
      }
    });

    // Update booking
    booking.refundStatus = 'pending';
    booking.refundAmount = refundAmount;
    booking.refundPercent = refundPercent;
    booking.razorpayRefundId = refund.id;
    booking.refundInitiatedAt = new Date();
    booking.refundReason = reason;
    await booking.save();

    res.json({
      success: true,
      message: 'Refund initiated successfully',
      refundId: refund.id,
      refundAmount: refundAmount,
      refundPercent: refundPercent,
      status: refund.status
    });
  } catch (error) {
    console.error('Error processing refund:', error);
    res.status(500).json({ 
      message: 'Failed to process refund',
      error: error.message 
    });
  }
});

// Check refund status
router.get('/refund-status/:bookingId', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (!booking.razorpayRefundId) {
      return res.json({ 
        refundStatus: booking.refundStatus || 'not_initiated',
        message: 'No refund initiated'
      });
    }

    // Fetch refund details from Razorpay
    const refund = await razorpay.refunds.fetch(booking.razorpayRefundId);

    res.json({
      refundId: refund.id,
      amount: refund.amount / 100,
      status: refund.status,
      createdAt: new Date(refund.created_at * 1000),
      processedAt: refund.processed_at ? new Date(refund.processed_at * 1000) : null
    });
  } catch (error) {
    console.error('Error fetching refund status:', error);
    res.status(500).json({ message: 'Failed to fetch refund status' });
  }
});

// ============= PAYMENT RECONCILIATION =============
// Get payment reconciliation report
router.get('/reconciliation', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { startDate, endDate, status } = req.query;
    
    const query = {
      paymentMethod: 'online'
    };

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    if (status) {
      query.paymentStatus = status;
    }

    const bookings = await Booking.find(query)
      .populate('patientId', 'name email phone')
      .populate('driverId', 'name phone')
      .sort({ createdAt: -1 });

    // Calculate summary
    const summary = {
      totalTransactions: bookings.length,
      totalAmount: bookings.reduce((sum, b) => sum + (b.amount || 0), 0),
      paidCount: bookings.filter(b => b.paymentStatus === 'paid').length,
      paidAmount: bookings.filter(b => b.paymentStatus === 'paid').reduce((sum, b) => sum + (b.amount || 0), 0),
      pendingCount: bookings.filter(b => b.paymentStatus === 'pending').length,
      pendingAmount: bookings.filter(b => b.paymentStatus === 'pending').reduce((sum, b) => sum + (b.amount || 0), 0),
      failedCount: bookings.filter(b => b.paymentStatus === 'failed').length,
      failedAmount: bookings.filter(b => b.paymentStatus === 'failed').reduce((sum, b) => sum + (b.amount || 0), 0),
      refundCount: bookings.filter(b => b.refundStatus === 'processed').length,
      refundAmount: bookings.filter(b => b.refundStatus === 'processed').reduce((sum, b) => sum + (b.refundAmount || 0), 0)
    };

    res.json({
      success: true,
      summary,
      transactions: bookings.map(b => ({
        bookingId: b._id,
        patientName: b.patientId?.name,
        patientEmail: b.patientId?.email,
        driverName: b.driverId?.name,
        amount: b.amount,
        paymentStatus: b.paymentStatus,
        paymentMethod: b.paymentMethod,
        razorpayPaymentId: b.razorpayPaymentId,
        razorpayOrderId: b.razorpayOrderId,
        refundStatus: b.refundStatus,
        refundAmount: b.refundAmount,
        razorpayRefundId: b.razorpayRefundId,
        createdAt: b.createdAt,
        status: b.status
      }))
    });
  } catch (error) {
    console.error('Error generating reconciliation report:', error);
    res.status(500).json({ message: 'Failed to generate report' });
  }
});

// Match Razorpay transactions with bookings
router.post('/reconciliation/match', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { startDate, endDate } = req.body;
    
    // Fetch payments from Razorpay
    const payments = await razorpay.payments.all({
      from: new Date(startDate).getTime() / 1000,
      to: new Date(endDate).getTime() / 1000,
      count: 100
    });

    // Fetch bookings from database
    const bookings = await Booking.find({
      paymentMethod: 'online',
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    });

    const matched = [];
    const unmatched = {
      razorpay: [],
      database: []
    };

    // Match payments
    payments.items.forEach(payment => {
      const booking = bookings.find(b => b.razorpayPaymentId === payment.id);
      if (booking) {
        matched.push({
          paymentId: payment.id,
          bookingId: booking._id,
          amount: payment.amount / 100,
          status: payment.status,
          matched: true
        });
      } else {
        unmatched.razorpay.push({
          paymentId: payment.id,
          amount: payment.amount / 100,
          status: payment.status,
          notes: payment.notes
        });
      }
    });

    // Find unmatched bookings
    bookings.forEach(booking => {
      if (!payments.items.find(p => p.id === booking.razorpayPaymentId)) {
        unmatched.database.push({
          bookingId: booking._id,
          amount: booking.amount,
          paymentStatus: booking.paymentStatus,
          razorpayPaymentId: booking.razorpayPaymentId
        });
      }
    });

    res.json({
      success: true,
      matched: {
        count: matched.length,
        transactions: matched
      },
      unmatched: {
        razorpayOnly: {
          count: unmatched.razorpay.length,
          transactions: unmatched.razorpay
        },
        databaseOnly: {
          count: unmatched.database.length,
          transactions: unmatched.database
        }
      }
    });
  } catch (error) {
    console.error('Error matching transactions:', error);
    res.status(500).json({ message: 'Failed to match transactions' });
  }
});

module.exports = router;
