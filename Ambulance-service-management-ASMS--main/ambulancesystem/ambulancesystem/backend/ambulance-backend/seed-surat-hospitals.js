const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Hospital = require('./models/Hospital');

dotenv.config();

const hospitals = [
  {
    name: 'New Civil Hospital',
    location: { type: 'Point', coordinates: [72.8311, 21.1702] },
    specialties: ['General', 'Trauma', 'Emergency', 'Government', 'ICU'],
    phone: '0261-2244456',
    address: 'Majura Gate, Ring Road, Surat'
  },
  {
    name: 'SMIMER Hospital & Medical College',
    location: { type: 'Point', coordinates: [72.8550, 21.1950] },
    specialties: ['Multi-specialty', 'Emergency', 'Government', 'ICU', 'Trauma'],
    phone: '0261-2378888',
    address: 'Sahara Darwaja, Umarwada, Surat'
  },
  {
    name: 'Kiran Multi Super Speciality Hospital',
    location: { type: 'Point', coordinates: [72.8500, 21.2200] },
    specialties: ['Multi-specialty', 'Cardiac', 'Oncology', 'Neurology', 'Pediatric', 'ICU'],
    phone: '0261-2333333',
    address: 'Near Sumul Dairy, Katargam, Surat'
  },
  {
    name: 'Sunshine Global Hospital',
    location: { type: 'Point', coordinates: [72.7800, 21.1500] },
    specialties: ['Cardiac', 'Orthopedic', 'ICU', 'Emergency', 'Multi-specialty'],
    phone: '0261-2200000',
    address: 'Dumas Road, Near Big Bazaar, Piplod, Surat'
  },
  {
    name: 'Apple Hospital',
    location: { type: 'Point', coordinates: [72.8200, 21.1800] },
    specialties: ['General', 'ICU', 'Trauma', 'Emergency'],
    phone: '0261-2444444',
    address: 'Opp. ST Workshop, Udhna Darwaja, Surat'
  },
  {
    name: 'Mahavir Super Speciality Hospital',
    location: { type: 'Point', coordinates: [72.8100, 21.1600] },
    specialties: ['Cardiac', 'Neurology', 'Orthopedic', 'Nephrology', 'Multi-specialty'],
    phone: '0261-2555555',
    address: 'Ring Road, Near Athwa Gate, Surat'
  },
  {
    name: 'United Green Hospital',
    location: { type: 'Point', coordinates: [72.7650, 21.1450] },
    specialties: ['Multi-specialty', 'ICU', 'Emergency', 'General Surgery'],
    phone: '0261-2222222',
    address: 'VIP Road, Vesu, Surat'
  },
  {
    name: 'Unique Hospital',
    location: { type: 'Point', coordinates: [72.8250, 21.1750] },
    specialties: ['General', 'Surgery', 'Trauma', 'Cardiac'],
    phone: '0261-2334455',
    address: 'Near Kinnary Cinema, Ring Road, Surat'
  },
  {
    name: 'Care Hospital',
    location: { type: 'Point', coordinates: [72.8080, 21.1620] },
    specialties: ['Cardiac', 'Critical Care', 'Emergency', 'ICU'],
    phone: '0261-2466666',
    address: 'Athwa Gate, Athwalines, Surat'
  },
  {
    name: 'Shelby Multi-Speciality Hospital',
    location: { type: 'Point', coordinates: [72.7950, 21.1900] },
    specialties: ['Orthopedic', 'Joint Replacement', 'Multi-specialty', 'ICU'],
    phone: '0261-2777777',
    address: 'Near Navyug College, Rander Road, Adajan, Surat'
  },
  {
    name: 'BAPS Pramukh Swami Hospital',
    location: { type: 'Point', coordinates: [72.7900, 21.1950] },
    specialties: ['Multi-specialty', 'General', 'Cardiac', 'Emergency', 'Ayurvedic'],
    phone: '0261-2788888',
    address: 'Anand Mahal Road, Adajan, Surat'
  },
  {
    name: 'Venus Hospital',
    location: { type: 'Point', coordinates: [72.8350, 21.1950] },
    specialties: ['General', 'Emergency', 'Surgery', 'ICU'],
    phone: '0261-2422222',
    address: 'Lal Darwaja, Station Road, Surat'
  },
  {
    name: 'Diamond Hospital',
    location: { type: 'Point', coordinates: [72.8600, 21.2100] },
    specialties: ['Maternity', 'Pediatric', 'General', 'Emergency'],
    phone: '0261-2544444',
    address: 'Matavadi, L.H. Road, Varachha, Surat'
  },
  {
    name: 'P.P. Savani Heart Institute & Multi-Speciality Hospital',
    location: { type: 'Point', coordinates: [72.8650, 21.2150] },
    specialties: ['Cardiac', 'Heart Surgery', 'Multi-specialty', 'ICU'],
    phone: '0261-2566666',
    address: 'Hirabaug, Varachha Road, Surat'
  },
  {
    name: 'Lokhat Hospital',
    location: { type: 'Point', coordinates: [72.8280, 21.2000] },
    specialties: ['General', 'Eye', 'Maternity', 'Emergency'],
    phone: '0261-2533333',
    address: 'Rampura, Near Chowk Bazar, Surat'
  },
  {
    name: 'Mission Hospital',
    location: { type: 'Point', coordinates: [72.8050, 21.1650] },
    specialties: ['General', 'Maternity', 'Orthopedic'],
    phone: '0261-2477777',
    address: 'Athwalines, Surat'
  },
  {
    name: 'Ashaktashram Hospital',
    location: { type: 'Point', coordinates: [72.8250, 21.2020] },
    specialties: ['General', 'Surgery', 'Orthopedic'],
    phone: '0261-2433333',
    address: 'Rampura, Surat'
  },
  {
    name: 'Tristar Multi Speciality Hospital',
    location: { type: 'Point', coordinates: [72.8020, 21.1680] },
    specialties: ['Multi-specialty', 'Cardiac', 'Emergency', 'ICU'],
    phone: '0261-2499999',
    address: 'Athwa Gate, Athwalines, Surat'
  },
  {
    name: 'Maitreya Multi Super Speciality Hospital',
    location: { type: 'Point', coordinates: [72.7700, 21.1400] },
    specialties: ['Multi-specialty', 'Cardiac', 'Nephrology', 'Critical Care'],
    phone: '0261-2911111',
    address: 'Near Someshwar Square, Vesu, Surat'
  },
  {
    name: 'Nirmal Hospital',
    location: { type: 'Point', coordinates: [72.8320, 21.1750] },
    specialties: ['Pediatric', 'Neonatal ICU', 'Multi-specialty'],
    phone: '0261-2355555',
    address: 'Near Kinnary Cinema, Ring Road, Surat'
  },
  {
    name: 'Sids Hospital & Research Centre',
    location: { type: 'Point', coordinates: [72.8290, 21.1710] },
    specialties: ['Gastroenterology', 'Liver Care', 'Multi-specialty'],
    phone: '0261-2366666',
    address: 'Near Majura Gate, Ring Road, Surat'
  },
  {
    name: 'Pranaam Hospital',
    location: { type: 'Point', coordinates: [72.7850, 21.1550] },
    specialties: ['Multi-specialty', 'Urology', 'General Surgery'],
    phone: '0261-2888888',
    address: 'Udhna Magdalla Road, Near Citylight, Surat'
  },
  {
    name: 'Aastha Hospital',
    location: { type: 'Point', coordinates: [72.7920, 21.1880] },
    specialties: ['General', 'Maternity', 'Pediatric', 'Gynecology'],
    phone: '0261-2766666',
    address: 'Near Gujarat Gas Circle, Adajan, Surat'
  },
  {
    name: 'Metas Adventist Hospital',
    location: { type: 'Point', coordinates: [72.8000, 21.1630] },
    specialties: ['General', 'Dental', 'Physiotherapy', 'ICU', 'Emergency'],
    phone: '0261-2488888',
    address: 'Athwalines, Surat'
  },
  {
    name: 'Surat General Hospital',
    location: { type: 'Point', coordinates: [72.8350, 21.1900] },
    specialties: ['General', 'Emergency', 'Surgery'],
    phone: '0261-2511111',
    address: 'Balaji Road, Near Begampura, Surat'
  },
  {
    name: 'Wockhardt Hospital',
    location: { type: 'Point', coordinates: [72.8330, 21.1730] },
    specialties: ['Kidney Care', 'Nephrology', 'Multi-specialty', 'Dialysis'],
    phone: '0261-2344444',
    address: 'Ring Road, Near Majura Gate, Surat'
  },
  {
    name: 'Seventh Day Adventist Hospital',
    location: { type: 'Point', coordinates: [72.7980, 21.1620] },
    specialties: ['General', 'Cardiology', 'Emergency', 'Maternity'],
    phone: '0261-2651111',
    address: 'Opp. Police Commissioner Office, Athwalines, Surat'
  },
  {
    name: 'Bankers Heart Institute & Hospital',
    location: { type: 'Point', coordinates: [72.8040, 21.1660] },
    specialties: ['Cardiac', 'Heart Surgery', 'Cath Lab', 'ICU'],
    phone: '0261-2661234',
    address: 'Near Vanita Vishram Ground, Athwagate, Surat'
  },
  {
    name: 'Blossom Multi Speciality Hospital',
    location: { type: 'Point', coordinates: [72.7660, 21.1480] },
    specialties: ['Multi-specialty', 'Gynecology', 'Pediatric', 'IVF'],
    phone: '0261-2877777',
    address: 'VIP Road, Vesu, Surat'
  },
  {
    name: 'Healing Hands Hospital',
    location: { type: 'Point', coordinates: [72.7680, 21.1440] },
    specialties: ['Proctology', 'General Surgery', 'Laparoscopy'],
    phone: '0261-2977777',
    address: 'Near Reliance Mall, Vesu, Surat'
  },
  {
    name: 'Sparsh Multi-Speciality Hospital',
    location: { type: 'Point', coordinates: [72.8150, 21.1850] },
    specialties: ['Orthopedic', 'Physiotherapy', 'Sports Medicine', 'ICU'],
    phone: '0261-2888888',
    address: 'Timaliyawad, Nanpura, Surat'
  },
  {
    name: 'Ayush Hospital',
    location: { type: 'Point', coordinates: [72.8450, 21.2250] },
    specialties: ['General', 'Emergency', 'ICU', 'Multi-specialty'],
    phone: '0261-2485555',
    address: 'Near Gotalawadi, Katargam, Surat'
  },
  {
    name: 'Shraddha Hospital',
    location: { type: 'Point', coordinates: [72.8680, 21.2180] },
    specialties: ['Maternity', 'General', 'Pediatric'],
    phone: '0261-2551122',
    address: 'Mini Bazar, Varachha, Surat'
  },
  {
    name: 'Shreyas Hospital',
    location: { type: 'Point', coordinates: [72.8480, 21.2220] },
    specialties: ['Multi-specialty', 'Orthopedic', 'General Surgery'],
    phone: '0261-2489999',
    address: 'Gajera Circle, Katargam, Surat'
  },
  {
    name: 'Unity Hospital',
    location: { type: 'Point', coordinates: [72.8720, 21.2200] },
    specialties: ['General', 'Trauma', 'Emergency', 'Surgery'],
    phone: '0261-2578899',
    address: 'Near Baroda Prestige, Varachha, Surat'
  },
  {
    name: 'Bharat Cancer Hospital & Research Institute',
    location: { type: 'Point', coordinates: [72.8950, 21.2050] },
    specialties: ['Oncology', 'Cancer Care', 'Chemotherapy', 'Radiotherapy'],
    phone: '0261-2601111',
    address: 'Niyol Patiya, Kadodara Road, Saroli, Surat'
  },
  {
    name: 'Vatsalya Hospital',
    location: { type: 'Point', coordinates: [72.7880, 21.1920] },
    specialties: ['Pediatric', 'Neonatal', 'Child Care'],
    phone: '0261-2741122',
    address: 'L.P. Savani Road, Adajan, Surat'
  },
  {
    name: 'Param Multi-Specialty Hospital',
    location: { type: 'Point', coordinates: [72.7630, 21.1410] },
    specialties: ['Multi-specialty', 'ICU', 'Emergency', 'Critical Care'],
    phone: '0261-2983344',
    address: 'Near Someshwara Enclave, Vesu, Surat'
  },
  {
    name: 'Sanjivani Multi Specialty Hospital',
    location: { type: 'Point', coordinates: [72.8620, 21.2140] },
    specialties: ['Multi-specialty', 'General', 'ICU'],
    phone: '0261-2541234',
    address: 'Kapodra, Varachha Road, Surat'
  },
  {
    name: 'Care & Cure Multi Speciality Hospital',
    location: { type: 'Point', coordinates: [72.8420, 21.2280] },
    specialties: ['General', 'Maternity', 'Pediatric', 'Emergency'],
    phone: '0261-2495566',
    address: 'Singanpore Road, Katargam, Surat'
  },
  {
    name: 'Divine Life Hospital',
    location: { type: 'Point', coordinates: [72.7830, 21.2140] },
    specialties: ['Multi-specialty', 'Emergency', 'ICU', 'Trauma'],
    phone: '0261-2767788',
    address: 'Near Canal Road, Palanpur Patia, Surat'
  },
  {
    name: 'Global Multi Speciality Hospital',
    location: { type: 'Point', coordinates: [72.7910, 21.1940] },
    specialties: ['Multi-specialty', 'Orthopedic', 'Cardiology'],
    phone: '0261-2781199',
    address: 'Honey Park Road, Adajan, Surat'
  },
  {
    name: 'Anupam Hospital',
    location: { type: 'Point', coordinates: [72.8470, 21.2210] },
    specialties: ['General', 'Surgery', 'Maternity'],
    phone: '0261-2483322',
    address: 'Laxminarayan Temple Road, Katargam, Surat'
  },
  {
    name: 'Radhika Children Hospital',
    location: { type: 'Point', coordinates: [72.7930, 21.1890] },
    specialties: ['Pediatric', 'Neonatal Care', 'NICU'],
    phone: '0261-2774455',
    address: 'Prime Arcade, Anand Mahal Road, Adajan, Surat'
  },
  {
    name: 'Samved Hospital',
    location: { type: 'Point', coordinates: [72.8120, 21.1830] },
    specialties: ['General', 'Gynecology', 'Endoscopy'],
    phone: '0261-2462233',
    address: 'Kailash Nagar, Nanpura, Surat'
  },
  {
    name: 'Ashirwad Multi Specialty Hospital',
    location: { type: 'Point', coordinates: [72.8390, 21.1580] },
    specialties: ['General', 'Emergency', 'ICU', 'Trauma'],
    phone: '0261-2275566',
    address: 'Main Road, Udhna, Surat'
  },
  {
    name: 'Rhythm Heart Institute',
    location: { type: 'Point', coordinates: [72.7890, 21.1930] },
    specialties: ['Cardiac', 'Heart Failure Clinic', 'ICU'],
    phone: '0261-2784411',
    address: 'Near Star Bazaar, Adajan, Surat'
  },
  {
    name: 'Shalby Hospital (Adajan)',
    location: { type: 'Point', coordinates: [72.7950, 21.1900] },
    specialties: ['Joint Replacement', 'Orthopedic', 'Cardiology', 'ICU'],
    phone: '0261-2777777',
    address: 'Rander Road, Adajan, Surat'
  },
  {
    name: 'Apple Children Hospital',
    location: { type: 'Point', coordinates: [72.8220, 21.1780] },
    specialties: ['Pediatric', 'NICU', 'PICU', 'Child Emergency'],
    phone: '0261-2445566',
    address: 'Near Khatodara, Udhna Darwaja, Surat'
  },
  {
    name: 'Surat Kidney & Dialysis Hospital',
    location: { type: 'Point', coordinates: [72.8360, 21.1720] },
    specialties: ['Nephrology', 'Dialysis', 'Urology', 'Kidney Transplant'],
    phone: '0261-2347788',
    address: 'Near Majura Gate, Ring Road, Surat'
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
