const mongoose = require('mongoose');

const ambulanceSchema = new mongoose.Schema(
  {
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', required: true, index: true },
    type: {
      type: String,
      enum: ['Normal', 'ICU', 'Cardiac', 'DeadBodyVan'],
      required: true,
      index: true
    },
    baseFare: { type: Number, required: true },
    perKmRate: { type: Number, required: true },
    registrationNumber: { type: String, required: true },
    capacity: { type: Number },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Ambulance', ambulanceSchema);
