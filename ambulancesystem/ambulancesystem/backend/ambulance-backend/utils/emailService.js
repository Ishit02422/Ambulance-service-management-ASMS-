const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Verify connection configuration
transporter.verify(function (error, success) {
  if (error) {
    console.log('Email Service Error:', error);
  } else {
    console.log('Email Service is ready to send messages');
  }
});

const sendOTP = async (email, otp) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Ambulance Service - Email Verification',
    text: `Your verification OTP is: ${otp}. It expires in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #d32f2f;">Verify Your Email</h2>
        <p>Thank you for registering with Ambulance Service.</p>
        <p>Your One-Time Password (OTP) for verification is:</p>
        <h1 style="color: #333; letter-spacing: 5px;">${otp}</h1>
        <p>This OTP is valid for 10 minutes.</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`OTP sent to ${email}`);
  } catch (error) {
    console.error('Error sending OTP email:', error);
    // In development without real creds, we might want to log the OTP to console to allow testing
    console.log('DEV MODE - OTP:', otp); 
  }
};

const sendWelcomeEmail = async (email, name) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Welcome to Ambulance Service!',
    text: `Hello ${name}, Welcome to Ambulance Service! Your account has been successfully verified.`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #2e7d32;">Welcome, ${name}!</h2>
        <p>Your email has been successfully verified.</p>
        <p>You can now log in to your dashboard.</p>
        <br>
        <p>Best Regards,<br>Ambulance Service Team</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Welcome email sent to ${email}`);
  } catch (error) {
    console.error('Error sending welcome email:', error);
  }
};

const sendDriverPendingEmail = async (email, name) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Application Submitted - Ambulance Service',
    text: `Hello ${name}, Your email is verified. Your application is now pending admin approval.`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #f57c00;">Application Received</h2>
        <p>Hello ${name},</p>
        <p>Your email has been successfully verified.</p>
        <p>Your driver application has been sent to the administrator for review.</p>
        <p>You will receive another email once your account is approved.</p>
        <br>
        <p>Best Regards,<br>Ambulance Service Team</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Driver pending email sent to ${email}`);
  } catch (error) {
    console.error('Error sending driver pending email:', error);
  }
};

const sendDriverApprovalEmail = async (email, name) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Driver Account Approved - Ambulance Service',
    text: `Hello ${name}, Your driver account has been approved by the admin. You can now log in and start accepting rides.`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #2e7d32;">Account Approved!</h2>
        <p>Hello ${name},</p>
        <p>Great news! Your driver account has been approved by the administrator.</p>
        <p>You can now log in to your dashboard and start accepting ambulance requests.</p>
        <br>
        <p>Drive safely!</p>
        <p>Best Regards,<br>Ambulance Service Team</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Driver approval email sent to ${email}`);
  } catch (error) {
    console.error('Error sending driver approval email:', error);
  }
};

const sendDriverRejectionEmail = async (email, name, reason) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Driver Application Update - Ambulance Service',
    text: `Hello ${name}, Your driver application has been rejected. Reason: ${reason}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #d32f2f;">Application Status Update</h2>
        <p>Hello ${name},</p>
        <p>We regret to inform you that your driver application has been rejected by the administrator.</p>
        <p><strong>Reason for rejection:</strong></p>
        <blockquote style="background: #f9f9f9; border-left: 4px solid #d32f2f; padding: 10px; margin: 10px 0;">
          ${reason}
        </blockquote>
        <p>Please correct the issues and register again, or contact support for more information.</p>
        <br>
        <p>Best Regards,<br>Ambulance Service Team</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Driver rejection email sent to ${email}`);
  } catch (error) {
    console.error('Error sending driver rejection email:', error);
  }
};

const sendPasswordResetEmail = async (email, resetUrl) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Password Reset Request - Ambulance Service',
    text: `You requested a password reset. Please click the following link to reset your password: ${resetUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #1976d2;">Password Reset Request</h2>
        <p>You requested a password reset for your Ambulance Service account.</p>
        <p>Please click the button below to reset your password:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #1976d2; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0;">Reset Password</a>
        <p>If you did not request this, please ignore this email.</p>
        <br>
        <p>Best Regards,<br>Ambulance Service Team</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to ${email}`);
  } catch (error) {
    console.error('Error sending password reset email:', error);
  }
};

const sendPasswordResetSuccessEmail = async (email, name) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Password Updated Successfully - Ambulance Service',
    text: `Hello ${name}, Your password has been successfully updated. If you did not perform this action, please contact support immediately.`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #2e7d32;">Password Updated</h2>
        <p>Hello ${name},</p>
        <p>Your password has been successfully updated.</p>
        <p>You can now log in with your new password.</p>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">If you did not perform this action, please contact support immediately.</p>
        <br>
        <p>Best Regards,<br>Ambulance Service Team</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Password reset success email sent to ${email}`);
  } catch (error) {
    console.error('Error sending password reset success email:', error);
  }
};

const sendBlockNotificationEmail = async (email, name, reason, duration, userType) => {
  const durationText = duration === 'permanent' 
    ? 'permanently' 
    : `for ${duration} day${duration > 1 ? 's' : ''}`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Account Blocked - Ambulance Service',
    text: `Hello ${name}, Your ${userType} account has been blocked ${durationText}. Reason: ${reason}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #d32f2f;">Account Blocked</h2>
        <p>Hello ${name},</p>
        <p>Your ${userType} account has been <strong>blocked ${durationText}</strong> by the administrator.</p>
        <p><strong>Reason for blocking:</strong></p>
        <blockquote style="background: #f9f9f9; border-left: 4px solid #d32f2f; padding: 10px; margin: 10px 0;">
          ${reason}
        </blockquote>
        ${duration !== 'permanent' ? `<p>Your account will be automatically unblocked after ${duration} day${duration > 1 ? 's' : ''}.</p>` : '<p>This is a permanent block. Please contact support if you believe this was a mistake.</p>'}
        <p>If you have any questions, please contact our support team.</p>
        <br>
        <p>Best Regards,<br>Ambulance Service Team</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Block notification email sent to ${email}`);
  } catch (error) {
    console.error('Error sending block notification email:', error);
  }
};

const sendUnblockNotificationEmail = async (email, name, userType) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Account Unblocked - Ambulance Service',
    text: `Hello ${name}, Your ${userType} account has been unblocked. You can now log in and use our services.`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #2e7d32;">Account Unblocked</h2>
        <p>Hello ${name},</p>
        <p>Good news! Your ${userType} account has been <strong>unblocked</strong> by the administrator.</p>
        <p>You can now log in to your dashboard and resume using our services.</p>
        <p>Thank you for your understanding.</p>
        <br>
        <p>Best Regards,<br>Ambulance Service Team</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Unblock notification email sent to ${email}`);
  } catch (error) {
    console.error('Error sending unblock notification email:', error);
  }
};

const sendPayoutNotificationEmail = async (email, driverName, amount, rideCount, payoutId) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Daily Payout Generated - Ambulance Service',
    text: `Hello ${driverName}, Your daily payout of ₹${amount} for ${rideCount} rides has been generated. Payout ID: ${payoutId}. You will receive the payment within 1-2 business days.`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #2e7d32;">Daily Payout Generated! 💰</h2>
        <p>Hello ${driverName},</p>
        <p>Great news! Your daily payout has been successfully generated.</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1976d2;">Payout Details</h3>
          <p><strong>Payout ID:</strong> ${payoutId}</p>
          <p><strong>Amount:</strong> <span style="font-size: 24px; color: #2e7d32;">₹${amount}</span></p>
          <p><strong>Number of Rides:</strong> ${rideCount}</p>
          <p><strong>Generated On:</strong> ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        
        <p>Your payment will be processed and transferred to your registered bank account within <strong>1-2 business days</strong>.</p>
        <p>You can track the payout status in your driver dashboard under the "Earnings" section.</p>
        
        <p style="margin-top: 20px;">Thank you for being a valued partner!</p>
        <br>
        <p>Best Regards,<br>Ambulance Service Team</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Payout notification email sent to ${email}`);
  } catch (error) {
    console.error('Error sending payout notification email:', error);
  }
};

module.exports = { 
  sendOTP, 
  sendWelcomeEmail, 
  sendDriverApprovalEmail, 
  sendDriverPendingEmail, 
  sendDriverRejectionEmail, 
  sendPasswordResetEmail, 
  sendPasswordResetSuccessEmail,
  sendBlockNotificationEmail,
  sendUnblockNotificationEmail,
  sendPayoutNotificationEmail
};
