const { body, param, query, validationResult } = require('express-validator');

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

// Common validation rules
const validateEmail = body('email')
  .trim()
  .isEmail()
  .withMessage('Please provide a valid email address')
  .normalizeEmail()
  .isLength({ max: 255 })
  .withMessage('Email must not exceed 255 characters');

const validatePassword = body('password')
  .trim()
  .isLength({ min: 6 })
  .withMessage('Password must be at least 6 characters')
  .matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])[A-Za-z\d!@#$%^&*(),.?":{}|<>]{6,}$/)
  .withMessage('Password must contain at least one uppercase letter, one digit, and one special character');

const validateName = body('name')
  .trim()
  .isLength({ min: 3, max: 100 })
  .withMessage('Name must be between 3 and 100 characters')
  .matches(/^[a-zA-Z\s]+$/)
  .withMessage('Name must contain only letters and spaces');

const validatePhone = body('phone')
  .trim()
  .matches(/^[0-9]{10}$/)
  .withMessage('Phone number must be exactly 10 digits');

// Auth validation rules
const registerValidation = [
  validateName,
  validateEmail,
  validatePassword,
  validatePhone,
  body('role')
    .isIn(['patient', 'driver'])
    .withMessage('Role must be either patient or driver'),
  body('address')
    .optional()
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Address must be between 10 and 500 characters'),
  // Driver-specific validations
  body('licenseNumber')
    .if(body('role').equals('driver'))
    .trim()
    .matches(/^[A-Z0-9]{16}$/)
    .withMessage('License number must be exactly 16 alphanumeric characters'),
  body('vehicleNumber')
    .if(body('role').equals('driver'))
    .trim()
    .matches(/^[A-Z]{2}-[0-9]{2}-[A-Z]{2}-[0-9]{4}$/)
    .withMessage('Vehicle number format must be XX-00-XX-0000'),
  body('ambulanceType')
    .if(body('role').equals('driver'))
    .isIn(['Normal', 'ICU', 'Cardiac', 'Dead Body Van'])
    .withMessage('Invalid ambulance type'),
  handleValidationErrors
];

const loginValidation = [
  validateEmail,
  body('password')
    .trim()
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
];

const forgotPasswordValidation = [
  validateEmail,
  handleValidationErrors
];

const resetPasswordValidation = [
  param('token')
    .trim()
    .notEmpty()
    .withMessage('Reset token is required'),
  validatePassword,
  handleValidationErrors
];

const otpValidation = [
  validateEmail,
  body('otp')
    .trim()
    .matches(/^[0-9]{6}$/)
    .withMessage('OTP must be exactly 6 digits'),
  body('role')
    .isIn(['patient', 'driver'])
    .withMessage('Role must be either patient or driver'),
  handleValidationErrors
];

// Booking validation rules
const createBookingValidation = [
  body('pickupLocation.lat')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Pickup latitude must be between -90 and 90'),
  body('pickupLocation.lng')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Pickup longitude must be between -180 and 180'),
  body('pickupLocation.address')
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Pickup address must be between 5 and 500 characters'),
  body('dropLocation.lat')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Drop latitude must be between -90 and 90'),
  body('dropLocation.lng')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Drop longitude must be between -180 and 180'),
  body('dropLocation.address')
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Drop address must be between 5 and 500 characters'),
  body('distanceKm')
    .isFloat({ min: 0.1 })
    .withMessage('Distance must be greater than 0'),
  body('ambulanceType')
    .isIn(['normal', 'icu', 'cardiac', 'dead_body_van'])
    .withMessage('Invalid ambulance type'),
  body('paymentMethod')
    .isIn(['cash', 'online'])
    .withMessage('Invalid payment method'),
  body('paymentStatus')
    .optional()
    .isIn(['pending', 'completed', 'failed'])
    .withMessage('Invalid payment status'),
  handleValidationErrors
];

const updateBookingStatusValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid booking ID'),
  body('status')
    .isIn(['accepted', 'on_the_way', 'reached', 'picked', 'dropped'])
    .withMessage('Invalid status'),
  handleValidationErrors
];

const cancelBookingValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid booking ID'),
  body('cancellationReason')
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Cancellation reason must be between 5 and 500 characters'),
  handleValidationErrors
];

// Feedback validation
const feedbackValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid booking ID'),
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('comment')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Comment must not exceed 1000 characters'),
  handleValidationErrors
];

// Profile update validation
const updateProfileValidation = [
  validateName
    .optional(),
  validateEmail
    .optional(),
  validatePhone
    .optional(),
  body('address')
    .optional()
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Address must be between 10 and 500 characters'),
  body('oldPassword')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Old password is required when changing password'),
  body('newPassword')
    .optional()
    .custom((value, { req }) => {
      if (value) {
        if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])[A-Za-z\d!@#$%^&*(),.?":{}|<>]{6,}$/.test(value)) {
          throw new Error('New password must be at least 6 characters with one uppercase, one digit, and one special character');
        }
      }
      return true;
    }),
  handleValidationErrors
];

// Payment validation
const paymentValidation = [
  body('amount')
    .isFloat({ min: 1 })
    .withMessage('Amount must be greater than 0'),
  body('currency')
    .optional()
    .isIn(['INR'])
    .withMessage('Currency must be INR'),
  handleValidationErrors
];

// MongoDB ID validation
const mongoIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format'),
  handleValidationErrors
];

// Query parameter validation
const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  registerValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  otpValidation,
  createBookingValidation,
  updateBookingStatusValidation,
  cancelBookingValidation,
  feedbackValidation,
  updateProfileValidation,
  paymentValidation,
  mongoIdValidation,
  paginationValidation
};
