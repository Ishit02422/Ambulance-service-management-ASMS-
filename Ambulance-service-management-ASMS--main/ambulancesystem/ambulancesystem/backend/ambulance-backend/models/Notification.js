const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userType: {
      type: String,
      enum: ['patient', 'driver'],
      required: true,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    title: { type: String },
    message: { type: String },
    type: {
      type: String,
      enum: ['booking', 'payment', 'alert', 'system'],
      required: true,
    },
    data: Object,
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
