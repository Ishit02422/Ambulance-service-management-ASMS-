const jwt = require('jsonwebtoken');
const Patient = require('../models/Patient');
const Driver = require('../models/Driver');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Try finding in Patient first (includes Admin)
      let user = await Patient.findById(decoded.id).select('-password');

      // If not found, try Driver
      if (!user) {
        const driver = await Driver.findById(decoded.id).select('-password');
        if (driver) {
          user = driver.toObject();
          user.role = 'driver'; // Manually attach role for drivers
        }
      }

      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error(error);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({ message: 'Admin access only' });
  }
};

const driverOnly = (req, res, next) => {
  if (req.user && req.user.role === 'driver') {
    next();
  } else {
    return res.status(403).json({ message: 'Driver access only' });
  }
};

module.exports = { protect, adminOnly, driverOnly };
