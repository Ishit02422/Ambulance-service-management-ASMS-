const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Patient = require('./models/Patient');
const connectDB = require('./config/db');
require('dotenv').config();

const seedAdmin = async () => {
  await connectDB();

  const email = 'admin@example.com';
  const password = 'adminpassword';

  const existingAdmin = await Patient.findOne({ email });
  if (existingAdmin) {
    console.log('Admin already exists');
    process.exit();
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  await Patient.create({
    name: 'Super Admin',
    email,
    phone: '0000000000',
    password: hashedPassword,
    role: 'admin',
    isVerified: true,
  });

  console.log('Admin created: admin@example.com / adminpassword');
  process.exit();
};

seedAdmin();
