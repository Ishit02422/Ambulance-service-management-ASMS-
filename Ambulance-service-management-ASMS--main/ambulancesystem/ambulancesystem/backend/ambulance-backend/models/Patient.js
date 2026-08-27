const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    phone: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    address: String,
    profilePhotoUrl: String,
    isVerified: { type: Boolean, default: false },
    otp: String,
    otpExpires: Date,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    preferences: {
      type: Map,
      of: String,
    },
    role: {
      type: String,
      enum: ['patient', 'admin'],
      default: 'patient',
    },
    emergencyContacts: [
      {
        name: String,
        phone: String,
        relation: String,
      },
    ],
    isBlocked: { type: Boolean, default: false },
    blockedUntil: Date,
    blockReason: String,
    blockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Patient', patientSchema);
