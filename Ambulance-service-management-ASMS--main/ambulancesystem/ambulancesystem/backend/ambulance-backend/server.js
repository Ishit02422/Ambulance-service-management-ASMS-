// Load environment variables FIRST, before any other requires
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const { startBlockScheduler } = require('./utils/blockScheduler');
const { scheduleDailyPayouts } = require('./utils/payoutScheduler');
const { apiLimiter } = require('./middleware/rateLimiter');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Allowed origins for CORS (production-ready)
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5174',
  process.env.FRONTEND_URL || 'http://localhost:5173',
  // Add production domain when deployed
  // 'https://yourdomain.com'
];

// Socket.io setup with secure CORS
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    credentials: true
  }
});

// Active driver tracking sessions
const activeDriverSessions = new Map(); // driverId -> { socketId, lastUpdate, bookingId }

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('join_driver_room', (userId) => {
    socket.join('drivers');
    if (userId) {
      socket.join(`driver_${userId}`);
      activeDriverSessions.set(userId, { 
        socketId: socket.id, 
        lastUpdate: Date.now(),
        bookingId: null 
      });
      console.log(`Socket ${socket.id} joined driver room: driver_${userId}`);
    } else {
      console.log(`Socket ${socket.id} joined drivers room`);
    }
  });

  socket.on('join_patient_room', (userId) => {
    socket.join(`patient_${userId}`);
    console.log(`Socket ${socket.id} joined patient room: patient_${userId}`);
  });

  // Real-time GPS location update from driver
  socket.on('driver_location_update', async (data) => {
    try {
      const { 
        driverId, 
        bookingId, 
        location, // { latitude, longitude }
        accuracy, 
        speed, 
        heading, 
        altitude,
        patientId 
      } = data;

      // Validate required fields
      if (!driverId || !location || !location.latitude || !location.longitude) {
        console.error('Invalid location data received:', data);
        return;
      }

      // Update active session
      if (activeDriverSessions.has(driverId)) {
        const session = activeDriverSessions.get(driverId);
        session.lastUpdate = Date.now();
        session.bookingId = bookingId;
      }

      // Store location in database
      const LocationHistory = require('./models/LocationHistory');
      await LocationHistory.create({
        driverId,
        bookingId: bookingId || null,
        location: {
          type: 'Point',
          coordinates: [location.longitude, location.latitude]
        },
        accuracy: accuracy || 0,
        speed: speed || 0,
        heading: heading || null,
        altitude: altitude || null,
        timestamp: new Date()
      });

      // Broadcast to patient tracking this booking
      if (patientId) {
        io.to(`patient_${patientId}`).emit('driver_location', {
          driverId,
          bookingId,
          location,
          accuracy,
          speed,
          heading,
          timestamp: new Date().toISOString()
        });
      }

      // Broadcast to all drivers (for admin dashboard)
      io.to('drivers').emit('driver_position_update', {
        driverId,
        bookingId,
        location,
        timestamp: new Date().toISOString()
      });

      console.log(`Location updated for driver ${driverId}:`, location);
    } catch (error) {
      console.error('Error handling location update:', error);
    }
  });

  // Driver starts a trip
  socket.on('start_trip', (data) => {
    const { driverId, bookingId } = data;
    if (activeDriverSessions.has(driverId)) {
      activeDriverSessions.get(driverId).bookingId = bookingId;
    }
  });

  // Driver ends a trip
  socket.on('end_trip', (data) => {
    const { driverId } = data;
    if (activeDriverSessions.has(driverId)) {
      activeDriverSessions.get(driverId).bookingId = null;
    }
  });

  socket.on('disconnect', () => {
    // Remove driver from active sessions
    for (const [driverId, session] of activeDriverSessions.entries()) {
      if (session.socketId === socket.id) {
        activeDriverSessions.delete(driverId);
        console.log(`Driver ${driverId} disconnected`);
        break;
      }
    }
    console.log('Client disconnected:', socket.id);
  });
});

// Cleanup stale sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  const staleThreshold = 5 * 60 * 1000; // 5 minutes
  
  for (const [driverId, session] of activeDriverSessions.entries()) {
    if (now - session.lastUpdate > staleThreshold) {
      activeDriverSessions.delete(driverId);
      console.log(`Removed stale session for driver ${driverId}`);
    }
  }
}, 5 * 60 * 1000);

// Make io available in routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Make io available via app.get()
app.set('io', io);

// DB connect
connectDB();

// Security Middleware
// Helmet - Set security HTTP headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false, // Required for some features
}));

// CORS - Configure allowed origins
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Data Sanitization against NoSQL injection
app.use(mongoSanitize());

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Apply rate limiting to all API routes
app.use('/api/', apiLimiter);

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve GPS test page
app.get('/test-gps', (req, res) => {
  res.sendFile(path.join(__dirname, 'test-gps.html'));
});

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Ambulance API running' });
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/drivers', require('./routes/driverRoutes'));
app.use('/api/hospitals', require('./routes/hospitalRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/admin', require('./routes/userManagementRoutes'));
app.use('/api/payment', require('./routes/paymentRoutes'));
app.use('/api/payouts', require('./routes/payoutRoutes'));
app.use('/api/location', require('./routes/locationRoutes'));

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Start the block scheduler
  startBlockScheduler();
  console.log('Block scheduler started - checking every hour');
  // Start the daily payout scheduler
  scheduleDailyPayouts();
});
