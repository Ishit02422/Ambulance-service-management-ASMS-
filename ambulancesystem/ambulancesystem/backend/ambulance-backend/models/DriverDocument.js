const mongoose = require('mongoose');

const driverDocumentSchema = new mongoose.Schema(
  {
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', required: true, index: true },
    type: {
      type: String,
      enum: ['license', 'rc', 'insurance', 'photo'],
      required: true,
    },
    url: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    uploadedAt: { type: Date, default: Date.now },
  }
);

module.exports = mongoose.model('DriverDocument', driverDocumentSchema);
