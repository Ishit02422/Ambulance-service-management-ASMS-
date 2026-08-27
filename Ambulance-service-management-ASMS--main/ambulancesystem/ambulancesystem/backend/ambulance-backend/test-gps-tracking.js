// GPS Tracking Validation Script
// Run this to test the complete GPS tracking implementation

const io = require('socket.io-client');
const axios = require('axios');

console.log('\n🧪 GPS Tracking System - Validation Test\n');
console.log('=' .repeat(60));

// Test Configuration
const SERVER_URL = 'http://localhost:5000';
const TEST_DRIVER_ID = 'test-driver-' + Date.now();
const TEST_BOOKING_ID = 'test-booking-' + Date.now();
const TEST_PATIENT_ID = 'test-patient-' + Date.now();

// Simulated GPS coordinates (moving path in Surat)
const GPS_PATH = [
  { lat: 21.1702, lng: 72.8311, speed: 0 },
  { lat: 21.1710, lng: 72.8320, speed: 25.5 },
  { lat: 21.1720, lng: 72.8330, speed: 30.2 },
  { lat: 21.1735, lng: 72.8345, speed: 28.7 },
  { lat: 21.1750, lng: 72.8360, speed: 32.1 },
  { lat: 21.1765, lng: 72.8375, speed: 35.4 },
  { lat: 21.1780, lng: 72.8390, speed: 40.0 },
  { lat: 21.1800, lng: 72.8410, speed: 38.5 },
  { lat: 21.1820, lng: 72.8430, speed: 42.3 },
  { lat: 21.1850, lng: 72.8450, speed: 45.0 }
];

let locationsSent = 0;
let locationsReceived = 0;
let testResults = {
  socketConnection: false,
  locationTransmission: false,
  databaseStorage: false,
  patientReceives: false,
  backgroundTracking: false
};

console.log('\n📋 Test Configuration:');
console.log(`Server URL: ${SERVER_URL}`);
console.log(`Driver ID: ${TEST_DRIVER_ID}`);
console.log(`Booking ID: ${TEST_BOOKING_ID}`);
console.log(`Patient ID: ${TEST_PATIENT_ID}`);
console.log(`GPS Path Points: ${GPS_PATH.length}`);

// Test 1: Socket.IO Connection
console.log('\n\n🔌 Test 1: Socket.IO Connection');
console.log('-'.repeat(60));

const driverSocket = io(SERVER_URL);
const patientSocket = io(SERVER_URL);

driverSocket.on('connect', () => {
  console.log('✅ Driver socket connected:', driverSocket.id);
  testResults.socketConnection = true;
  
  // Join driver room
  driverSocket.emit('join_driver_room', TEST_DRIVER_ID);
  console.log('✅ Driver joined room');
  
  // Start Test 2
  setTimeout(() => testLocationTransmission(), 1000);
});

patientSocket.on('connect', () => {
  console.log('✅ Patient socket connected:', patientSocket.id);
  
  // Join patient room
  patientSocket.emit('join_patient_room', TEST_PATIENT_ID);
  console.log('✅ Patient joined room');
});

driverSocket.on('connect_error', (error) => {
  console.log('❌ Driver socket connection error:', error.message);
});

patientSocket.on('connect_error', (error) => {
  console.log('❌ Patient socket connection error:', error.message);
});

// Test 2: Location Transmission
function testLocationTransmission() {
  console.log('\n\n📍 Test 2: Location Transmission');
  console.log('-'.repeat(60));
  
  let pathIndex = 0;
  
  // Start trip
  driverSocket.emit('start_trip', {
    driverId: TEST_DRIVER_ID,
    bookingId: TEST_BOOKING_ID
  });
  console.log('🚗 Trip started');
  
  // Send location updates every 2 seconds
  const locationInterval = setInterval(() => {
    if (pathIndex >= GPS_PATH.length) {
      clearInterval(locationInterval);
      console.log(`\n✅ Sent ${locationsSent} location updates`);
      testResults.locationTransmission = true;
      
      // End trip
      driverSocket.emit('end_trip', { driverId: TEST_DRIVER_ID });
      console.log('🛑 Trip ended');
      
      // Wait for database writes, then test database
      setTimeout(() => testDatabaseStorage(), 2000);
      return;
    }
    
    const point = GPS_PATH[pathIndex];
    const locationData = {
      driverId: TEST_DRIVER_ID,
      bookingId: TEST_BOOKING_ID,
      location: {
        latitude: point.lat,
        longitude: point.lng
      },
      accuracy: 15 + Math.random() * 10, // 15-25 meters
      speed: point.speed,
      heading: 90 + Math.random() * 20, // 90-110 degrees
      altitude: 10 + Math.random() * 5,
      patientId: TEST_PATIENT_ID
    };
    
    driverSocket.emit('driver_location_update', locationData);
    locationsSent++;
    
    console.log(`📡 Sent location ${locationsSent}/${GPS_PATH.length}: ` +
                `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)} ` +
                `(${point.speed.toFixed(1)} km/h)`);
    
    pathIndex++;
  }, 2000); // Every 2 seconds
}

// Test 3: Patient Receives Updates
patientSocket.on('driver_location', (data) => {
  locationsReceived++;
  testResults.patientReceives = true;
  
  console.log(`📲 Patient received location ${locationsReceived}: ` +
              `${data.location.latitude.toFixed(6)}, ${data.location.longitude.toFixed(6)} ` +
              `(accuracy: ${data.accuracy?.toFixed(0)}m, speed: ${data.speed?.toFixed(1)} km/h)`);
});

// Test 4: Database Storage
async function testDatabaseStorage() {
  console.log('\n\n💾 Test 3: Database Storage');
  console.log('-'.repeat(60));
  
  try {
    // Connect directly to MongoDB
    const mongoose = require('mongoose');
    require('dotenv').config();
    
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    const LocationHistory = require('./models/LocationHistory');
    
    // Check if locations were stored
    const storedLocations = await LocationHistory.find({
      driverId: TEST_DRIVER_ID,
      bookingId: TEST_BOOKING_ID
    }).sort({ timestamp: 1 });
    
    console.log(`\n📊 Database Results:`);
    console.log(`   Expected: ${locationsSent} locations`);
    console.log(`   Stored: ${storedLocations.length} locations`);
    
    if (storedLocations.length > 0) {
      testResults.databaseStorage = true;
      console.log('✅ Locations successfully stored in database');
      
      // Show first and last location
      const first = storedLocations[0];
      const last = storedLocations[storedLocations.length - 1];
      
      console.log(`\n   First location:`);
      console.log(`     Coordinates: [${first.location.coordinates[1]}, ${first.location.coordinates[0]}]`);
      console.log(`     Accuracy: ${first.accuracy.toFixed(0)}m`);
      console.log(`     Speed: ${first.speed.toFixed(1)} km/h`);
      console.log(`     Timestamp: ${first.timestamp.toISOString()}`);
      
      console.log(`\n   Last location:`);
      console.log(`     Coordinates: [${last.location.coordinates[1]}, ${last.location.coordinates[0]}]`);
      console.log(`     Accuracy: ${last.accuracy.toFixed(0)}m`);
      console.log(`     Speed: ${last.speed.toFixed(1)} km/h`);
      console.log(`     Timestamp: ${last.timestamp.toISOString()}`);
      
      // Calculate distance
      const distance = await LocationHistory.calculateDistance(TEST_BOOKING_ID);
      console.log(`\n   Total distance traveled: ${distance.toFixed(2)} km`);
      
    } else {
      console.log('❌ No locations found in database');
    }
    
    await mongoose.connection.close();
    
  } catch (error) {
    console.log('❌ Database test failed:', error.message);
  }
  
  // Print final results
  printTestResults();
}

// Print final test results
function printTestResults() {
  console.log('\n\n📊 Test Results Summary');
  console.log('='.repeat(60));
  
  const tests = [
    { name: 'Socket.IO Connection', status: testResults.socketConnection },
    { name: 'Location Transmission', status: testResults.locationTransmission },
    { name: 'Patient Receives Updates', status: testResults.patientReceives },
    { name: 'Database Storage', status: testResults.databaseStorage }
  ];
  
  tests.forEach(test => {
    const icon = test.status ? '✅' : '❌';
    const status = test.status ? 'PASS' : 'FAIL';
    console.log(`${icon} ${test.name.padEnd(30)} ${status}`);
  });
  
  const passCount = tests.filter(t => t.status).length;
  const totalCount = tests.length;
  
  console.log('\n' + '='.repeat(60));
  console.log(`\n🎯 Overall Result: ${passCount}/${totalCount} tests passed`);
  
  if (passCount === totalCount) {
    console.log('🎉 All tests passed! GPS tracking system is working correctly.\n');
  } else {
    console.log('⚠️ Some tests failed. Please check the implementation.\n');
  }
  
  // Cleanup
  driverSocket.disconnect();
  patientSocket.disconnect();
  process.exit(passCount === totalCount ? 0 : 1);
}

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('\n❌ Unhandled error:', error);
  process.exit(1);
});

console.log('\n\n⏳ Starting tests in 2 seconds...\n');
