const express = require('express');
const Driver = require('../models/Driver');
const Patient = require('../models/Patient');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { sendBlockNotificationEmail, sendUnblockNotificationEmail } = require('../utils/emailService');

const router = express.Router();

// @route POST /api/admin/users/:userType/:userId/block
// @desc Block a user (driver or patient)
router.post('/users/:userType/:userId/block', protect, adminOnly, async (req, res) => {
  try {
    const { userType, userId } = req.params;
    const { reason, duration } = req.body; // duration in days

    let Model = userType === 'driver' ? Driver : Patient;
    const user = await Model.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isBlocked = true;
    user.blockReason = reason;
    user.blockedBy = req.user._id;
    
    if (duration && duration !== 'permanent') {
      const durationInDays = parseInt(duration);
      user.blockedUntil = new Date(Date.now() + durationInDays * 24 * 60 * 60 * 1000);
    } else if (duration === 'permanent') {
      user.blockedUntil = null; // Permanent block
    }

    await user.save();

    // Send block notification email
    await sendBlockNotificationEmail(
      user.email, 
      user.name, 
      reason, 
      duration, 
      userType
    );

    // Notify the user via Socket.IO to logout if they're currently logged in
    if (req.app.get('io')) {
      const io = req.app.get('io');
      const roomName = userType === 'driver' ? `driver_${userId}` : `patient_${userId}`;
      io.to(roomName).emit('user_blocked', {
        message: duration === 'permanent' 
          ? `Your account has been permanently blocked. Reason: ${reason}`
          : `Your account has been blocked for ${duration} day(s). Reason: ${reason}`,
        reason,
        duration,
        blockedUntil: user.blockedUntil
      });
    }

    res.json({ message: 'User blocked successfully', user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route POST /api/admin/users/:userType/:userId/unblock
// @desc Unblock a user
router.post('/users/:userType/:userId/unblock', protect, adminOnly, async (req, res) => {
  try {
    const { userType, userId } = req.params;

    let Model = userType === 'driver' ? Driver : Patient;
    const user = await Model.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isBlocked = false;
    user.blockReason = undefined;
    user.blockedUntil = undefined;
    user.blockedBy = undefined;

    await user.save();

    // Send unblock notification email
    await sendUnblockNotificationEmail(
      user.email, 
      user.name, 
      userType
    );

    res.json({ message: 'User unblocked successfully', user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
