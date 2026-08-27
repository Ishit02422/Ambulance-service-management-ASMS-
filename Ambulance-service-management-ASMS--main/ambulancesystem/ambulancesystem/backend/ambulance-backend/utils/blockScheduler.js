const cron = require('node-cron');
const Driver = require('../models/Driver');
const Patient = require('../models/Patient');
const { sendUnblockNotificationEmail } = require('./emailService');

// Run every hour to check for expired blocks
const startBlockScheduler = () => {
  cron.schedule('0 * * * *', async () => {
    console.log('Checking for expired user blocks...');
    
    try {
      const now = new Date();

      // Check drivers with expired blocks
      const blockedDrivers = await Driver.find({
        isBlocked: true,
        blockedUntil: { $ne: null, $lte: now }
      });

      for (const driver of blockedDrivers) {
        driver.isBlocked = false;
        driver.blockReason = undefined;
        driver.blockedUntil = undefined;
        driver.blockedBy = undefined;
        await driver.save();

        // Send unblock notification email
        await sendUnblockNotificationEmail(driver.email, driver.name, 'driver');
        console.log(`Driver ${driver.name} (${driver.email}) automatically unblocked`);
      }

      // Check patients with expired blocks
      const blockedPatients = await Patient.find({
        isBlocked: true,
        blockedUntil: { $ne: null, $lte: now }
      });

      for (const patient of blockedPatients) {
        patient.isBlocked = false;
        patient.blockReason = undefined;
        patient.blockedUntil = undefined;
        patient.blockedBy = undefined;
        await patient.save();

        // Send unblock notification email
        await sendUnblockNotificationEmail(patient.email, patient.name, 'patient');
        console.log(`Patient ${patient.name} (${patient.email}) automatically unblocked`);
      }

      if (blockedDrivers.length > 0 || blockedPatients.length > 0) {
        console.log(`Unblocked ${blockedDrivers.length} drivers and ${blockedPatients.length} patients`);
      }
    } catch (error) {
      console.error('Error in block scheduler:', error);
    }
  });

  console.log('Block scheduler started - checking every hour');
};

module.exports = { startBlockScheduler };
