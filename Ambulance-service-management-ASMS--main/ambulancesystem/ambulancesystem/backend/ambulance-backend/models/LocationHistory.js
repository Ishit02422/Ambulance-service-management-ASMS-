const mongoose = require('mongoose');

const locationHistorySchema = new mongoose.Schema({
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    index: true
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  accuracy: {
    type: Number, // GPS accuracy in meters
    required: true
  },
  speed: {
    type: Number, // Speed in km/h
    default: 0
  },
  heading: {
    type: Number, // Direction in degrees (0-360)
    default: null
  },
  altitude: {
    type: Number, // Altitude in meters
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Geospatial index for location-based queries
locationHistorySchema.index({ location: '2dsphere' });

// Compound index for efficient querying
locationHistorySchema.index({ driverId: 1, timestamp: -1 });
locationHistorySchema.index({ bookingId: 1, timestamp: -1 });

// TTL index to auto-delete location history older than 30 days
// Note: Using createdAt from timestamps instead of timestamp field to avoid duplicate index
locationHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

// Virtual for latitude
locationHistorySchema.virtual('latitude').get(function() {
  return this.location.coordinates[1];
});

// Virtual for longitude
locationHistorySchema.virtual('longitude').get(function() {
  return this.location.coordinates[0];
});

// Method to get location trail for a booking
locationHistorySchema.statics.getBookingTrail = async function(bookingId, startTime, endTime) {
  const query = { bookingId };
  
  if (startTime || endTime) {
    query.timestamp = {};
    if (startTime) query.timestamp.$gte = new Date(startTime);
    if (endTime) query.timestamp.$lte = new Date(endTime);
  }
  
  return this.find(query)
    .sort({ timestamp: 1 })
    .select('location accuracy speed heading timestamp')
    .lean();
};

// Method to get recent driver location
locationHistorySchema.statics.getRecentLocation = async function(driverId, minutes = 5) {
  const timeLimit = new Date(Date.now() - minutes * 60 * 1000);
  
  return this.findOne({
    driverId,
    timestamp: { $gte: timeLimit }
  })
  .sort({ timestamp: -1 })
  .select('location accuracy speed timestamp')
  .lean();
};

// Method to calculate distance traveled
locationHistorySchema.statics.calculateDistance = async function(bookingId) {
  const trail = await this.find({ bookingId })
    .sort({ timestamp: 1 })
    .select('location')
    .lean();
  
  if (trail.length < 2) return 0;
  
  let totalDistance = 0;
  for (let i = 1; i < trail.length; i++) {
    const [lng1, lat1] = trail[i - 1].location.coordinates;
    const [lng2, lat2] = trail[i].location.coordinates;
    
    // Haversine formula for distance calculation
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    totalDistance += R * c;
  }
  
  return totalDistance; // Returns distance in km
};

module.exports = mongoose.model('LocationHistory', locationHistorySchema);
