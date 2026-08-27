const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Hospital = require('./models/Hospital');

dotenv.config();

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
  },
  {
    name: 'New Civil Hospital',
    location: { type: 'Point', coordinates: [72.8653, 21.2050] },
    specialties: ['General', 'Emergency', 'Surgery'],
    phone: '0261-2666666',
    address: 'Ring Road, Surat'
  },
  {
    name: 'SMIMER Hospital',
    location: { type: 'Point', coordinates: [72.7750, 21.1590] },
    specialties: ['Multi-specialty', 'Research', 'Teaching'],
    phone: '0261-2777777',
    address: 'Udhna, Surat'
  },
  {
    name: 'Sparsh Hospital',
    location: { type: 'Point', coordinates: [72.8150, 21.1850] },
    specialties: ['Orthopedic', 'Physiotherapy', 'Sports Medicine'],
    phone: '0261-2888888',
    address: 'Nanpura, Surat'
  },
  {
    name: 'Raj Hospital',
    location: { type: 'Point', coordinates: [72.8550, 21.1950] },
    specialties: ['General', 'Maternity', 'Pediatric'],
    phone: '0261-2999999',
    address: 'Varachha, Surat'
  },
  {
    name: 'Shalby Hospital',
    location: { type: 'Point', coordinates: [72.8400, 21.2100] },
    specialties: ['Multi-specialty', 'Orthopedic', 'Joint Replacement'],
    phone: '0261-3000000',
    address: 'Adajan, Surat'
  },
  {
    name: 'Unique Hospital',
    location: { type: 'Point', coordinates: [72.8920, 21.2280] },
    specialties: ['Cardiac', 'Neurology', 'ICU'],
    phone: '0261-3111111',
    address: 'Bhatar Road, Surat'
  },
  {
    name: 'Aadicura Super Speciality Hospital',
    location: { type: 'Point', coordinates: [72.8050, 21.1750] },
    specialties: ['Cardiac', 'Nephrology', 'Dialysis'],
    phone: '0261-3222222',
    address: 'Athwalines, Surat'
  },
  {
    name: 'Surat Heart Hospital',
    location: { type: 'Point', coordinates: [72.8350, 21.1880] },
    specialties: ['Cardiac', 'Cardiology', 'Heart Surgery'],
    phone: '0261-3333333',
    address: 'Ghod Dod Road, Surat'
  },
  {
    name: 'Surat Kidney Hospital',
    location: { type: 'Point', coordinates: [72.8680, 21.2150] },
    specialties: ['Nephrology', 'Urology', 'Kidney Transplant'],
    phone: '0261-3444444',
    address: 'Vesu, Surat'
  },
  {
    name: 'Om Hospital',
    location: { type: 'Point', coordinates: [72.8250, 21.1920] },
    specialties: ['General', 'Surgery', 'ICU'],
    phone: '0261-3555555',
    address: 'Parle Point, Surat'
  },
  {
    name: 'Surat Cancer Hospital',
    location: { type: 'Point', coordinates: [72.8450, 21.2050] },
    specialties: ['Oncology', 'Cancer Treatment', 'Chemotherapy'],
    phone: '0261-3666666',
    address: 'Canal Road, Surat'
  },
  {
    name: 'Shalya Hospital',
    location: { type: 'Point', coordinates: [72.7950, 21.1650] },
    specialties: ['Surgery', 'Laparoscopy', 'General'],
    phone: '0261-3777777',
    address: 'Althan, Surat'
  },
  {
    name: 'Surat Eye Hospital',
    location: { type: 'Point', coordinates: [72.8280, 21.1980] },
    specialties: ['Ophthalmology', 'Eye Care', 'Cataract'],
    phone: '0261-3888888',
    address: 'City Light, Surat'
  },
  {
    name: 'Shalby Multi Specialty Hospital',
    location: { type: 'Point', coordinates: [72.8750, 21.2200] },
    specialties: ['Multi-specialty', 'Orthopedic', 'Cardiac'],
    phone: '0261-3999999',
    address: 'Pal, Surat'
  },
  {
    name: 'Cure Well Hospital',
    location: { type: 'Point', coordinates: [72.8150, 21.2050] },
    specialties: ['General', 'Pediatric', 'Maternity'],
    phone: '0261-4000000',
    address: 'Rander Road, Surat'
  },
  {
    name: 'Lifecare Hospital',
    location: { type: 'Point', coordinates: [72.8580, 21.2180] },
    specialties: ['Multi-specialty', 'ICU', 'Emergency'],
    phone: '0261-4111111',
    address: 'LP Savani Road, Surat'
  },
  {
    name: 'Nirmal Hospital',
    location: { type: 'Point', coordinates: [72.8380, 21.1760] },
    specialties: ['General', 'Surgery', 'Maternity'],
    phone: '0261-4222222',
    address: 'Majura Gate, Surat'
  },
  {
    name: 'Prime Hospital',
    location: { type: 'Point', coordinates: [72.8820, 21.2320] },
    specialties: ['Multi-specialty', 'Trauma', 'Emergency'],
    phone: '0261-4333333',
    address: 'Magdalla, Surat'
  },
  {
    name: 'Care Hospital',
    location: { type: 'Point', coordinates: [72.7880, 21.1580] },
    specialties: ['General', 'ICU', 'Pediatric'],
    phone: '0261-4444444',
    address: 'Honey Park, Surat'
  },
  {
    name: 'Navjeevan Hospital',
    location: { type: 'Point', coordinates: [72.8480, 21.1890] },
    specialties: ['Cardiac', 'Neurology', 'Multi-specialty'],
    phone: '0261-4555555',
    address: 'Citylight Road, Surat'
  }
];

const seedHospitals = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');

    await Hospital.deleteMany();
    console.log('Cleared existing hospitals');

    await Hospital.insertMany(hospitals);
    console.log(`✅ ${hospitals.length} Hospitals seeded successfully`);

    process.exit();
  } catch (error) {
    console.error('❌ Error seeding hospitals:', error);
    process.exit(1);
  }
};

seedHospitals();
