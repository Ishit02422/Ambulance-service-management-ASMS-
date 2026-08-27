const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    bookingId: { type: String, required: true, unique: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', index: true },
    ambulanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ambulance' },
    ambulanceType: { type: String, required: true },
    pickupLocation: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    pickupAddress: String,
    dropLocation: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    dropAddress: String,
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
    status: {
      type: String,
      enum: ['requested', 'accepted', 'assigned', 'on_the_way', 'reached', 'picked', 'dropped', 'cancelled'],
      default: 'requested',
      index: true,
    },
    distance: { type: Number }, // In KM
    estimatedAmount: { type: Number },
    amount: { type: Number },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'upi', 'card', 'wallet', 'online'],
      default: 'cash',
    },
    paymentFailureReason: { type: String },
    paymentRetryCount: { type: Number, default: 0 },
    driverEarnings: { type: Number }, // Driver's share after commission
    platformCommission: { type: Number }, // Platform's commission
    payoutStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed'],
      default: 'pending',
    },
    payoutDate: { type: Date },
    otp: { type: String },
    startedAt: { type: Date },
    completedAt: { type: Date },
    priority: {
      type: String,
      enum: ['normal', 'sos'],
      default: 'normal',
    },
    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String },
    driverReply: { type: String },
    feedbackDate: { type: Date },
    cancellationReason: { type: String },
    cancelledAt: { type: Date },
    cancelledBy: { type: String, enum: ['patient', 'driver', 'admin'] },
    refundAmount: { type: Number },
    refundPercent: { type: Number },
    refundStatus: { 
      type: String, 
      enum: ['not_initiated', 'pending', 'processed', 'failed'],
      default: 'not_initiated'
    },
    refundReason: { type: String },
    refundInitiatedAt: { type: Date },
    refundProcessedAt: { type: Date },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    razorpayRefundId: { type: String },
  },
  { timestamps: true }
);

bookingSchema.index({ pickupLocation: '2dsphere' });

module.exports = mongoose.model('Booking', bookingSchema);
