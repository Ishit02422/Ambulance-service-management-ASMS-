const mongoose = require('mongoose');

const sosAlertSchema = new mongoose.Schema(
  {
    driverId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Driver', 
      required: true,
      index: true 
    },
    message: { type: String },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        default: [0, 0],
      },
    },
    status: {
      type: String,
      enum: ['active', 'resolved', 'dismissed'],
      default: 'active',
      index: true,
    },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
    resolvedAt: { type: Date },
    notes: { type: String }
  },
  { timestamps: true }
);

sosAlertSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('SOSAlert', sosAlertSchema);
