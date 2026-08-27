const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Hospital = require('../backend/ambulance-backend/models/Hospital');

dotenv.config({ path: '../backend/ambulance-backend/.env' });

const hospitals = [
  {
    name: 'Civil Hospital Surat',
    location: { type: 'Point', coordinates: [72.8311, 21.1702] },
    specialties: ['General', 'Trauma', 'Emergency'],
    phone: '0261-2244456',
    address: 'Majura Gate, Surat'
  },
  {
    name: 'Sunshine Global Hospital',
    location: { type: 'Point', coordinates: [72.7800, 21.1500] },
    specialties: ['Cardiac', 'Orthopedic', 'ICU'],
    phone: '0261-2200000',
    address: 'Piplod, Surat'
  },
  {
    name: 'Kiran Hospital',
    location: { type: 'Point', coordinates: [72.8500, 21.2200] },
    specialties: ['Multi-specialty', 'Pediatric', 'Oncology'],
    phone: '0261-2333333',
    address: 'Katargam, Surat'
  },
  {
    name: 'Apple Hospital',
    location: { type: 'Point', coordinates: [72.8200, 21.1800] },
    specialties: ['General', 'ICU'],
    phone: '0261-2444444',
    address: 'Udhna Darwaja, Surat'
  },
  {
    name: 'Mahavir Hospital',
    location: { type: 'Point', coordinates: [72.8100, 21.1600] },
    specialties: ['Cardiac', 'Neurology'],
    phone: '0261-2555555',
    address: 'Athwa Gate, Surat'
  }
];

const seedHospitals = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');

    await Hospital.deleteMany();
    console.log('Cleared existing hospitals');

    await Hospital.insertMany(hospitals);
    console.log('Hospitals seeded successfully');

    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

seedHospitals();
