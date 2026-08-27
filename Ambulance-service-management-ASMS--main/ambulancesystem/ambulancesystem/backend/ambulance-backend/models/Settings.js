const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  fareRates: {
    normal: { 
      base: { type: Number, default: 200 }, 
      perKm: { type: Number, default: 15 } 
    },
    icu: { 
      base: { type: Number, default: 500 }, 
      perKm: { type: Number, default: 30 } 
    },
    cardiac: { 
      base: { type: Number, default: 600 }, 
      perKm: { type: Number, default: 35 } 
    },
    dead_body_van: { 
      base: { type: Number, default: 300 }, 
      perKm: { type: Number, default: 20 } 
    }
  },
  commission: {
    platformPercent: { type: Number, default: 30 },
    driverPercent: { type: Number, default: 70 }
  },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Settings', settingsSchema);
