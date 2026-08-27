const mongoose = require('mongoose');

const payoutSchema = new mongoose.Schema({
  payoutId: { type: String, required: true, unique: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', required: true, index: true },
  amount: { type: Number, required: true },
  bookingIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }],
  rideCount: { type: Number, default: 0 },
  payoutDate: { type: Date, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'completed', 'failed'], 
    default: 'pending',
    index: true
  },
  paymentMethod: { type: String, default: 'bank_transfer' },
  transactionId: String,
  failureReason: String,
  completedAt: Date,
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Admin who processed it
  notes: String
}, { timestamps: true });

payoutSchema.index({ driverId: 1, payoutDate: -1 });
payoutSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Payout', payoutSchema);
