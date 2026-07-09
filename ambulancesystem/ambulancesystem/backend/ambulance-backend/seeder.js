const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const Patient = require('./models/Patient');
const Driver = require('./models/Driver');
const connectDB = require('./config/db');

dotenv.config();

connectDB();

const importData = async () => {
  try {
    await Patient.deleteMany();
    await Driver.deleteMany();

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);

    // 1. Create Admin (as a Patient with role='admin')
    await Patient.create({
      name: 'Admin User',
      email: 'admin@ambulance.com',
      password: hashedPassword,
      role: 'admin',
      phone: '9999999999',
      address: 'Admin HQ',
      isVerified: true,
    });

    console.log('Admin User Created:');
    console.log('Email: admin@ambulance.com');
    console.log('Password: admin123');

    // 2. Create Patient
    await Patient.create({
      name: 'John Doe',
      email: 'patient@test.com',
      password: hashedPassword,
      role: 'patient',
      phone: '8888888888',
      address: '123 Main St',
      isVerified: true,
    });

    console.log('Patient User Created:');
    console.log('Email: patient@test.com');
    console.log('Password: admin123');

    // 3. Create Driver (Standalone)
    await Driver.create({
      name: 'Jane Driver',
      email: 'driver@test.com',
      phone: '7777777777',
      password: hashedPassword,
      licenseNumber: 'ABC1234567890123',
      vehicleNumber: 'GJ-01-AB-1234',
      ambulanceType: 'Normal',
      status: 'online',
      location: {
        type: 'Point',
        coordinates: [72.5714, 23.0225], // Ahmedabad coordinates
      },
      isApproved: true,
      isEmailVerified: true,
    });

    console.log('Driver User Created:');
    console.log('Email: driver@test.com');
    console.log('Password: admin123');

    console.log('Data Imported!');
    process.exit();
  } catch (error) {
    console.error(`${error}`);
    process.exit(1);
  }
};

importData();
