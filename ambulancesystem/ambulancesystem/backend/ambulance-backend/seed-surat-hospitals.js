const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Hospital = require('./models/Hospital');

dotenv.config();

const hospitals = [
  // Existing
  {
    name: 'New Civil Hospital',
    location: { type: 'Point', coordinates: [72.8311, 21.1702] },
    specialties: ['General', 'Trauma', 'Emergency', 'Government'],
    phone: '0261-2244456',
    address: 'Majura Gate, Surat'
  },
  {
    name: 'Sunshine Global Hospital',
    location: { type: 'Point', coordinates: [72.7800, 21.1500] },
    specialties: ['Cardiac', 'Orthopedic', 'ICU', 'Multi-specialty'],
    phone: '0261-2200000',
    address: 'Piplod, Surat'
  },
  {
    name: 'Kiran Multi Super Speciality Hospital',
    location: { type: 'Point', coordinates: [72.8500, 21.2200] },
    specialties: ['Multi-specialty', 'Pediatric', 'Oncology', 'Cardiac'],
    phone: '0261-2333333',
    address: 'Katargam, Surat'
  },
  {
    name: 'Apple Hospital',
    location: { type: 'Point', coordinates: [72.8200, 21.1800] },
    specialties: ['General', 'ICU', 'Trauma'],
    phone: '0261-2444444',
    address: 'Udhna Darwaja, Surat'
  },
  {
    name: 'Mahavir Super Speciality Hospital',
    location: { type: 'Point', coordinates: [72.8100, 21.1600] },
    specialties: ['Cardiac', 'Neurology', 'Orthopedic'],
    phone: '0261-2555555',
    address: 'Athwa Gate, Surat'
  },
  // New Additions
  {
    name: 'United Green Hospital',
    location: { type: 'Point', coordinates: [72.7650, 21.1450] },
    specialties: ['Multi-specialty', 'ICU', 'Emergency'],
    phone: '0261-2222222',
    address: 'Vesu, Surat'
  },
  {
    name: 'Unique Hospital',
    location: { type: 'Point', coordinates: [72.8250, 21.1750] },
    specialties: ['General', 'Surgery', 'Trauma'],
    phone: '0261-2334455',
    address: 'Near Kinnary Cinema, Ring Road, Surat'
  },
  {
    name: 'Care Hospital',
    location: { type: 'Point', coordinates: [72.8080, 21.1620] },
    specialties: ['Cardiac', 'Critical Care'],
    phone: '0261-2466666',
    address: 'Athwa Gate, Surat'
  },
  {
    name: 'Shelby Hospital',
    location: { type: 'Point', coordinates: [72.7950, 21.1900] },
    specialties: ['Orthopedic', 'Joint Replacement', 'Multi-specialty'],
    phone: '0261-2777777',
    address: 'Adajan, Surat'
  },
  {
    name: 'BAPS Yogiji Maharaj Hospital',
    location: { type: 'Point', coordinates: [72.7900, 21.1950] },
    specialties: ['General', 'Ayurvedic', 'Multi-specialty'],
    phone: '0261-2788888',
    address: 'Adajan, Surat'
  },
  {
    name: 'Venus Hospital',
    location: { type: 'Point', coordinates: [72.8350, 21.1950] },
    specialties: ['General', 'Emergency'],
    phone: '0261-2422222',
    address: 'Lal Darwaja, Surat'
  },
  {
    name: 'Diamond Hospital',
    location: { type: 'Point', coordinates: [72.8600, 21.2100] },
    specialties: ['Maternity', 'Pediatric', 'General'],
    phone: '0261-2544444',
    address: 'Varachha, Surat'
  },
  {
    name: 'P.P. Savani Heart Institute',
    location: { type: 'Point', coordinates: [72.8650, 21.2150] },
    specialties: ['Cardiac', 'Multi-specialty'],
    phone: '0261-2566666',
    address: 'Varachha, Surat'
  },
  {
    name: 'Lokhat Hospital',
    location: { type: 'Point', coordinates: [72.8280, 21.2000] },
    specialties: ['General', 'Surgery'],
    phone: '0261-2433333',
    address: 'Rampura, Surat'
  },
  {
    name: 'Mission Hospital',
    location: { type: 'Point', coordinates: [72.8050, 21.1650] },
    specialties: ['General', 'Missionary'],
    phone: '0261-2477777',
    address: 'Athwalines, Surat'
  },
  {
    name: 'Ashaktashram Hospital',
    location: { type: 'Point', coordinates: [72.8300, 21.2050] },
    specialties: ['Ayurvedic', 'General'],
    phone: '0261-2411111',
    address: 'Rampura, Surat'
  },
  {
    name: 'Tristar Hospital',
    location: { type: 'Point', coordinates: [72.8020, 21.1680] },
    specialties: ['Multi-specialty', 'Critical Care'],
    phone: '0261-2666666',
    address: 'Athwa, Surat'
  },
  {
    name: 'Maitreya Multi Super Speciality Hospital',
    location: { type: 'Point', coordinates: [72.7700, 21.1400] },
    specialties: ['Cancer', 'Multi-specialty'],
    phone: '0261-2999999',
    address: 'Vesu, Surat'
  },
  {
    name: 'Nirmal Hospital',
    location: { type: 'Point', coordinates: [72.8320, 21.1750] },
    specialties: ['Pediatric', 'General', 'ICU'],
    phone: '0261-2355555',
    address: 'Ring Road, Surat'
  },
  {
    name: 'Sids Hospital',
    location: { type: 'Point', coordinates: [72.8290, 21.1710] },
    specialties: ['Pediatric', 'Neonatal'],
    phone: '0261-2366666',
    address: 'Majura Gate, Surat'
  },
  {
    name: 'Pranaam Hospital',
    location: { type: 'Point', coordinates: [72.7850, 21.1550] },
    specialties: ['Multi-specialty', 'Urology'],
    phone: '0261-2888888',
    address: 'Udhna Magdalla Road, Surat'
  },
  {
    name: 'Aastha Hospital',
    location: { type: 'Point', coordinates: [72.7920, 21.1880] },
    specialties: ['General', 'Maternity'],
    phone: '0261-2766666',
    address: 'Adajan, Surat'
  },
  {
    name: 'Metas Adventist Hospital',
    location: { type: 'Point', coordinates: [72.8000, 21.1630] },
    specialties: ['General', 'Dental', 'Physiotherapy'],
    phone: '0261-2488888',
    address: 'Athwalines, Surat'
  },
  {
    name: 'Surat General Hospital',
    location: { type: 'Point', coordinates: [72.8350, 21.1900] },
    specialties: ['General', 'Emergency'],
    phone: '0261-2511111',
    address: 'Surat'
  },
  {
    name: 'Wockhardt Hospital',
    location: { type: 'Point', coordinates: [72.8330, 21.1730] },
    specialties: ['Kidney', 'Multi-specialty'],
    phone: '0261-2344444',
    address: 'Ring Road, Surat'
  }
];

const seedHospitals = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');

    await Hospital.deleteMany();
    console.log('Cleared existing hospitals');

    await Hospital.insertMany(hospitals);
    console.log(`Seeded ${hospitals.length} hospitals successfully`);

    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

seedHospitals();
