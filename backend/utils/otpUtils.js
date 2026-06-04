/**
 * OTP Utility
 * Sends OTP via Twilio if configured, otherwise logs to console (dev mode).
 */

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6-digit
}

async function sendOTP(mobileNumber, otp, businessName) {
  const isDev = process.env.NODE_ENV !== 'production';
  const hasTwilio = process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER &&
    !process.env.TWILIO_ACCOUNT_SID.includes('xxxx');

  const shopName = businessName || process.env.SHOP_NAME || 'ShopBill Pro';
  // Enhancement 4: custom OTP message for registered admin mobile
  const message = `[${shopName}] Your admin OTP is: ${otp}. Valid for 1 minute. Do NOT share this code with anyone.`;

  if (hasTwilio) {
    try {
      const twilio = require('twilio');
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      await client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: `+91${mobileNumber}`,
      });
      console.log(`📱 OTP sent to registered admin mobile ${mobileNumber} via Twilio`);
      return { success: true, method: 'sms' };
    } catch (err) {
      console.error('Twilio error:', err.message);
    }
  }

  // Dev fallback: print to console
  console.log('\n' + '='.repeat(55));
  console.log(`📲 Admin OTP for ${mobileNumber}: ${otp}`);
  console.log(`   Message: "${message}"`);
  console.log('   (Twilio not configured — using console fallback)');
  console.log('='.repeat(55) + '\n');
  return { success: true, method: 'console', otp: isDev ? otp : undefined };
}

module.exports = { generateOTP, sendOTP };
