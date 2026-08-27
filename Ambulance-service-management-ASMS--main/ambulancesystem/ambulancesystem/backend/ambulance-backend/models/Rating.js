const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String },
    driverReply: { type: String },
    repliedAt: { type: Date }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Rating', ratingSchema);
