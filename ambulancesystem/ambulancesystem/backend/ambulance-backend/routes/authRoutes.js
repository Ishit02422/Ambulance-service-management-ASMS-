const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Patient = require('../models/Patient');
const Driver = require('../models/Driver');
const DriverDocument = require('../models/DriverDocument');
const crypto = require('crypto');
const { sendOTP, sendWelcomeEmail, sendDriverPendingEmail, sendPasswordResetEmail, sendPasswordResetSuccessEmail } = require('../utils/emailService');
const upload = require('../utils/upload');
const { 
  registerValidation, 
  loginValidation, 
  forgotPasswordValidation, 
  resetPasswordValidation, 
  otpValidation,
  updateProfileValidation 
} = require('../middleware/validators');
const { 
  authLimiter, 
  registerLimiter, 
  passwordResetLimiter, 
  otpLimiter 
} = require('../middleware/rateLimiter');

const router = express.Router();

// @route GET /api/auth/seed
router.get('/seed', async (req, res) => {
  try {
    const email = 'admin@ambulance.com';
    const password = 'admin123';

    const existingAdmin = await Patient.findOne({ email });
    if (existingAdmin) {
      return res.status(200).json({ message: 'Admin already exists in database', email });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await Patient.create({
      name: 'Admin User',
      email,
      password: hashedPassword,
      role: 'admin',
      phone: '9999999999',
      address: 'Admin HQ',
      isVerified: true,
    });

    return res.status(201).json({ message: 'Admin User Created Successfully', email, password });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Seeding failed', error: err.message });
  }
});

// @route GET /api/auth/public-stats
router.get('/public-stats', async (req, res) => {
  try {
    const Hospital = require('../models/Hospital');
    const Booking = require('../models/Booking');
    
    const ambulancesCount = await Driver.countDocuments({ isApproved: true });
    const hospitalsCount = await Hospital.countDocuments({});
    const tripsCount = await Booking.countDocuments({ status: 'dropped' });
    
    const currentYear = new Date().getFullYear();
    const yearsActive = Math.max(10, currentYear - 2015);

    res.json({
      ambulances: 120 + ambulancesCount,
      hospitals: 48 + hospitalsCount,
      trips: 3500 + tripsCount,
      years: yearsActive
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch public stats', error: err.message });
  }
});

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
};

// @route POST /api/auth/register
router.post('/register', registerLimiter, upload.fields([
  { name: 'licenseFile', maxCount: 1 },
  { name: 'rcFile', maxCount: 1 },
  { name: 'photoFile', maxCount: 1 }
]), registerValidation, async (req, res) => {
  try {
    console.log('Register Request Body:', req.body);
    console.log('Register Request Files:', req.files);

    const { name, email, password, role, licenseNumber, vehicleNumber, ambulanceType, phone, address } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({ message: 'Please fill all required fields' });
    }

    // Check if user exists in EITHER Patient or Driver collection
    const existingPatient = await Patient.findOne({ $or: [{ email }, { phone }] });
    const existingDriver = await Driver.findOne({ $or: [{ email }, { phone }] });

    if (existingPatient) {
      if (!existingPatient.isVerified) {
        console.log(`Deleting unverified patient to allow re-registration: ${existingPatient.email}`);
        await Patient.findByIdAndDelete(existingPatient._id);
      } else {
        return res.status(400).json({ 
          message: `User already exists! Matched in Patients: Email: ${existingPatient.email}, Phone: ${existingPatient.phone}` 
        });
      }
    }

    if (existingDriver) {
      if (!existingDriver.isEmailVerified) {
        console.log(`Deleting unverified driver to allow re-registration: ${existingDriver.email}`);
        await DriverDocument.deleteMany({ driverId: existingDriver._id });
        await Driver.findByIdAndDelete(existingDriver._id);
      } else {
        return res.status(400).json({ 
          message: `User already exists! Matched in Drivers: Email: ${existingDriver.email}, Phone: ${existingDriver.phone}` 
        });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    
    // Log OTP immediately for dev/testing ease in production logs
    console.log(`[VERIFICATION OTP] For Email: ${email} -> OTP is: ${otp}`);

    if (role === 'driver') {
      // DRIVER REGISTRATION
      if (!licenseNumber || !vehicleNumber || !ambulanceType) {
        return res.status(400).json({ message: 'Driver details are required' });
      }

      // Check for files
      if (!req.files || !req.files['licenseFile'] || !req.files['rcFile'] || !req.files['photoFile']) {
        return res.status(400).json({ message: 'Please upload License, RC, and Photo' });
      }

      const driver = await Driver.create({
        name,
        email,
        phone,
        password: hashedPassword,
        licenseNumber,
        vehicleNumber,
        ambulanceType,
        status: 'offline',
        isApproved: false,
        isEmailVerified: false,
        otp,
        otpExpires
      });

      // Create Documents
      const licenseDoc = await DriverDocument.create({
        driverId: driver._id,
        type: 'license',
        url: '/uploads/' + req.files['licenseFile'][0].filename,
        status: 'pending'
      });

      const rcDoc = await DriverDocument.create({
        driverId: driver._id,
        type: 'rc',
        url: '/uploads/' + req.files['rcFile'][0].filename,
        status: 'pending'
      });

      const photoDoc = await DriverDocument.create({
        driverId: driver._id,
        type: 'photo',
        url: '/uploads/' + req.files['photoFile'][0].filename,
        status: 'pending'
      });

      // Update driver with document references
      driver.documents = [licenseDoc._id, rcDoc._id, photoDoc._id];
      await driver.save();

      // Send OTP in background so it doesn't block the request
      sendOTP(email, otp).catch(err => console.error('Background sendOTP error:', err));

      return res.status(201).json({
        message: 'Registration successful. Please verify your email.',
        email: driver.email,
        role: 'driver',
        requiresOtp: true,
        devOtp: otp
      });

    } else {
      // PATIENT / ADMIN REGISTRATION
      const patient = await Patient.create({
        name,
        email,
        phone,
        password: hashedPassword,
        address,
        role: role === 'admin' ? 'admin' : 'patient',
        isVerified: false, // Require OTP
        otp,
        otpExpires
      });

      // Send OTP in background so it doesn't block the request
      sendOTP(email, otp).catch(err => console.error('Background sendOTP error:', err));

      return res.status(201).json({
        message: 'Registration successful. Please verify your email.',
        email: patient.email,
        role: patient.role,
        requiresOtp: true,
        devOtp: otp
      });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route POST /api/auth/login
router.post('/login', authLimiter, loginValidation, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Try finding in Patient first
    let user = await Patient.findOne({ email });
    let role = user ? user.role : null;

    // If not found, try Driver
    if (!user) {
      user = await Driver.findOne({ email });
      if (user) role = 'driver';
    }

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check Email Verification
    if (role === 'driver') {
      if (!user.isEmailVerified) {
        return res.status(403).json({ message: 'Please verify your email first.' });
      }
    } else {
      if (!user.isVerified) {
        return res.status(403).json({ message: 'Please verify your email first.' });
      }
    }

    // Check if user is blocked
    if (user.isBlocked) {
      // Check if block period has expired
      if (user.blockedUntil && new Date() > user.blockedUntil) {
        // Block period expired, automatically unblock
        user.isBlocked = false;
        user.blockReason = undefined;
        user.blockedUntil = undefined;
        user.blockedBy = undefined;
        await user.save();
      } else {
        // Still blocked
        const blockMessage = user.blockedUntil 
          ? `Your account is blocked until ${new Date(user.blockedUntil).toLocaleString()}. Reason: ${user.blockReason || 'Policy violation'}`
          : `Your account has been permanently blocked. Reason: ${user.blockReason || 'Policy violation'}`;
        return res.status(403).json({ message: blockMessage });
      }
    }

    // If driver, set status to online
    if (role === 'driver') {
      user.status = 'online';
      await user.save();
    }

    return res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: role,
      isVerified: role === 'driver' ? user.isApproved : user.isVerified,
      token: generateToken(user._id, role),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

const { protect } = require('../middleware/authMiddleware');

// @route GET /api/auth/profile
router.get('/profile', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const role = req.user.role;

    let user;
    if (role === 'driver') {
      user = await Driver.findById(userId).select('-password');
    } else {
      user = await Patient.findById(userId).select('-password');
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route PUT /api/auth/profile
router.put('/profile', protect, async (req, res) => {
  try {
    const { name, email, phone, address, password } = req.body;
    const userId = req.user._id;
    const role = req.user.role;

    let user;
    let Model;

    if (role === 'driver') {
      Model = Driver;
    } else {
      Model = Patient;
    }

    user = await Model.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (role === 'admin') {
      // Admin can only update email and password
      if (email && email !== user.email) {
        const exists = await Patient.findOne({ email });
        if (exists) return res.status(400).json({ message: 'Email already in use' });
        user.email = email;
      }
      // Skip name, phone, address updates for admin
    } else {
      // Normal users (Patient/Driver)
      if (email && email !== user.email) {
        const exists = await Model.findOne({ email });
        if (exists) return res.status(400).json({ message: 'Email already in use' });
        user.email = email;
      }

      if (phone && phone !== user.phone) {
        const exists = await Model.findOne({ phone });
        if (exists) return res.status(400).json({ message: 'Phone already in use' });
        user.phone = phone;
      }

      if (name) user.name = name;
      if (address !== undefined) user.address = address;
    }

    // Password Update Logic
    if (req.body.newPassword) {
      if (!req.body.oldPassword) {
        return res.status(400).json({ message: 'Old password is required to set a new password' });
      }

      const isMatch = await bcrypt.compare(req.body.oldPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Incorrect old password' });
      }

      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(req.body.newPassword, salt);
    }

    await user.save();

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: role,
      address: user.address,
      message: 'Profile updated successfully'
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route POST /api/auth/verify-otp
router.post('/verify-otp', otpLimiter, otpValidation, async (req, res) => {
  try {
    const { email, otp, role } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    let user;
    let Model;

    if (role === 'driver') {
      Model = Driver;
    } else {
      Model = Patient;
    }

    user = await Model.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    if (user.otpExpires < Date.now()) {
      return res.status(400).json({ message: 'OTP expired' });
    }

    // Verify User
    if (role === 'driver') {
      user.isEmailVerified = true;
    } else {
      user.isVerified = true;
    }

    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    // Send verification emails in background
    if (role === 'driver') {
      sendDriverPendingEmail(user.email, user.name).catch(err => console.error('Background email error:', err));
    } else {
      sendWelcomeEmail(user.email, user.name).catch(err => console.error('Background email error:', err));
    }

    return res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: role || user.role,
      isVerified: role === 'driver' ? user.isApproved : user.isVerified,
      token: generateToken(user._id, role || user.role),
      message: 'Email verified successfully'
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route POST /api/auth/forgot-password
router.post('/forgot-password', passwordResetLimiter, forgotPasswordValidation, async (req, res) => {
  try {
    const { email } = req.body;
    
    let user = await Patient.findOne({ email });
    let role = 'patient';
    
    if (!user) {
      user = await Driver.findOne({ email });
      role = 'driver';
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found with this email' });
    }

    // Generate Reset Token
    const resetToken = crypto.randomBytes(20).toString('hex');
    
    // Hash and set to resetPasswordToken field
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 Minutes

    await user.save();

    // Create reset url
    const resetUrl = `http://localhost:5173/reset-password/${resetToken}`;

    try {
      await sendPasswordResetEmail(user.email, resetUrl);
      res.json({ message: 'Email sent' });
    } catch (err) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();
      return res.status(500).json({ message: 'Email could not be sent' });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route POST /api/auth/reset-password/:token
router.post('/reset-password/:token', passwordResetLimiter, resetPasswordValidation, async (req, res) => {
  try {
    const resetPasswordToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    let user = await Patient.findOne({
      resetPasswordToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      user = await Driver.findOne({
        resetPasswordToken,
        resetPasswordExpires: { $gt: Date.now() }
      });
    }

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    // Set new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(req.body.password, salt);
    
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    // Send success email
    await sendPasswordResetSuccessEmail(user.email, user.name);

    res.json({ message: 'Password updated successfully' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
