const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    amount: { type: Number, required: true },
    method: {
      type: String,
      enum: ['upi', 'cash', 'card', 'wallet'],
      required: true,
    },
    providerTxId: { type: String },
    status: {
      type: String,
      enum: ['success', 'failed', 'pending'],
      default: 'pending',
      index: true,
    },
    meta: Object,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', transactionSchema);
