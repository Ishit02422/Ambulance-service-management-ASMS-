const rateLimit = require('express-rate-limit');

// General API rate limiter - 100 requests per 60 seconds
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 60 seconds
  max: 100,
  message: {
    message: 'Too many requests from this IP, please try again after 60 seconds',
    retryAfter: '60 seconds'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for authentication routes - 5 attempts per 60 seconds
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 60 seconds
  max: 5,
  skipSuccessfulRequests: false,
  message: {
    message: 'Too many login attempts from this IP, please try again after 60 seconds',
    retryAfter: '60 seconds'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Registration limiter - 100 registrations per 60 seconds
const registerLimiter = rateLimit({
  windowMs: 60 * 1000, // 60 seconds
  max: 100,
  message: {
    message: 'Too many accounts created from this IP, please try again after 60 seconds',
    retryAfter: '60 seconds'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Password reset limiter - 3 attempts per 60 seconds
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 1000, // 60 seconds
  max: 3,
  message: {
    message: 'Too many password reset attempts, please try again after 60 seconds',
    retryAfter: '60 seconds'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// OTP verification limiter - 5 attempts per 60 seconds
const otpLimiter = rateLimit({
  windowMs: 60 * 1000, // 60 seconds
  max: 5,
  message: {
    message: 'Too many OTP verification attempts, please try again after 60 seconds',
    retryAfter: '60 seconds'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Payment limiter - 10 payment attempts per 60 seconds
const paymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 60 seconds
  max: 10,
  message: {
    message: 'Too many payment attempts, please try again after 60 seconds',
    retryAfter: '60 seconds'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  apiLimiter,
  authLimiter,
  registerLimiter,
  passwordResetLimiter,
  otpLimiter,
  paymentLimiter
};
