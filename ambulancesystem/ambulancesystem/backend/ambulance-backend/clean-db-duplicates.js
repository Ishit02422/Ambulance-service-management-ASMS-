const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const Patient = require('./models/Patient');
const Driver = require('./models/Driver');

async function run() {
  try {
    console.log('Connecting to MONGO_URI:', process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected!');

    // 1. Find invalid patients (missing email, missing phone, nulls, etc.)
    const invalidPatients = await Patient.find({
      $or: [
        { email: { $in: [null, '', 'undefined', 'null'] } },
        { phone: { $in: [null, '', 'undefined', 'null'] } }
      ]
    });

    console.log(`Found ${invalidPatients.length} invalid patients to clean.`);
    for (const p of invalidPatients) {
      console.log(`Deleting Patient: ID: ${p._id}, Name: ${p.name}, Email: ${p.email}, Phone: ${p.phone}`);
      await Patient.findByIdAndDelete(p._id);
    }

    // 2. Find invalid drivers
    const invalidDrivers = await Driver.find({
      $or: [
        { email: { $in: [null, '', 'undefined', 'null'] } },
        { phone: { $in: [null, '', 'undefined', 'null'] } }
      ]
    });

    console.log(`Found ${invalidDrivers.length} invalid drivers to clean.`);
    for (const d of invalidDrivers) {
      console.log(`Deleting Driver: ID: ${d._id}, Name: ${d.name}, Email: ${d.email}, Phone: ${d.phone}`);
      await Driver.findByIdAndDelete(d._id);
    }

    console.log('Clean complete!');
    mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
