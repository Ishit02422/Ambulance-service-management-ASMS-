const cron = require('node-cron');
const Driver = require('../models/Driver');
const Booking = require('../models/Booking');
const Payout = require('../models/Payout');
const { sendPayoutNotificationEmail } = require('./emailService');

// Generate unique payout ID
const generatePayoutId = () => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 7);
  return `PO-${timestamp}${randomStr}`.toUpperCase();
};

// Run daily at 11:59 PM to process payouts for completed rides
const scheduleDailyPayouts = () => {
  // Run every day at 11:59 PM
  cron.schedule('59 23 * * *', async () => {
    console.log('Running daily payout processing...');
    
    try {
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));

      // Find all drivers who have completed rides today with paid status
      const driversWithEarnings = await Booking.aggregate([
        {
          $match: {
            status: 'dropped',
            paymentStatus: 'paid',
            payoutStatus: 'pending',
            completedAt: { $gte: startOfDay, $lte: endOfDay }
          }
        },
        {
          $group: {
            _id: '$driverId',
            totalEarnings: { $sum: '$driverEarnings' },
            rideCount: { $sum: 1 },
            bookingIds: { $push: '$_id' }
          }
        }
      ]);

      console.log(`Found ${driversWithEarnings.length} drivers with pending payouts`);

      for (const driverData of driversWithEarnings) {
        if (!driverData._id || driverData.totalEarnings <= 0) continue;

        const driver = await Driver.findById(driverData._id);
        if (!driver) continue;

        // Create payout record
        const payout = new Payout({
          payoutId: generatePayoutId(),
          driverId: driver._id,
          amount: driverData.totalEarnings,
          bookingIds: driverData.bookingIds,
          rideCount: driverData.rideCount,
          payoutDate: new Date(),
          status: 'pending',
          paymentMethod: 'bank_transfer'
        });
        await payout.save();

        // Update bookings to 'processing'
        await Booking.updateMany(
          { _id: { $in: driverData.bookingIds } },
          { 
            payoutStatus: 'processing',
            payoutDate: new Date()
          }
        );

        // Send email notification to driver
        try {
          await sendPayoutNotificationEmail(
            driver.email, 
            driver.name, 
            driverData.totalEarnings,
            driverData.rideCount,
            payout.payoutId
          );
        } catch (emailError) {
          console.error(`Failed to send payout email to ${driver.email}:`, emailError);
        }

        console.log(`Payout ${payout.payoutId} created for driver ${driver.name}: ₹${driverData.totalEarnings} (${driverData.rideCount} rides)`);
      }

      console.log('Daily payout processing completed successfully');
    } catch (error) {
      console.error('Daily payout processing error:', error);
    }
  });

  console.log('Daily payout scheduler initialized - runs every day at 11:59 PM');
};

// Manual trigger for testing or admin override
const processDailyPayoutsNow = async () => {
  console.log('Manually triggering daily payout processing...');
  
  try {
    // Get all pending bookings (regardless of date for manual trigger)
    const driversWithEarnings = await Booking.aggregate([
      {
        $match: {
          status: 'dropped',
          paymentStatus: 'paid',
          payoutStatus: 'pending'
        }
      },
      {
        $group: {
          _id: '$driverId',
          totalEarnings: { $sum: '$driverEarnings' },
          rideCount: { $sum: 1 },
          bookingIds: { $push: '$_id' }
        }
      }
    ]);

    const results = [];

    for (const driverData of driversWithEarnings) {
      if (!driverData._id || driverData.totalEarnings <= 0) continue;

      const driver = await Driver.findById(driverData._id);
      if (!driver) continue;

      const payout = new Payout({
        payoutId: generatePayoutId(),
        driverId: driver._id,
        amount: driverData.totalEarnings,
        bookingIds: driverData.bookingIds,
        rideCount: driverData.rideCount,
        payoutDate: new Date(),
        status: 'pending',
        paymentMethod: 'bank_transfer'
      });
      await payout.save();

      await Booking.updateMany(
        { _id: { $in: driverData.bookingIds } },
        { 
          payoutStatus: 'processing',
          payoutDate: new Date()
        }
      );

      results.push({
        driver: driver.name,
        amount: driverData.totalEarnings,
        rides: driverData.rideCount,
        payoutId: payout.payoutId
      });
    }

    return results;
  } catch (error) {
    console.error('Manual payout processing error:', error);
    throw error;
  }
};

module.exports = { 
  scheduleDailyPayouts,
  processDailyPayoutsNow
};
