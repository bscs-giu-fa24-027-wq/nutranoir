// WhatsApp Notification Service
// Supports: Twilio (paid) or Console Logging (free testing)

let twilioClient = null;

const initializeWhatsAppService = () => {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    const twilio = require('twilio');
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    console.log('✅ Twilio WhatsApp service initialized');
    return true;
  } else {
    console.warn('⚠️ Twilio not configured. Using console logging for WhatsApp messages.');
    return false;
  }
};

// Send order notification via WhatsApp to admin
const sendOrderNotificationWhatsApp = async (order, customerName, customerEmail) => {
  try {
    const adminNumber = process.env.WHATSAPP_NUMBER;
    if (!adminNumber) {
      console.warn('⚠️ WHATSAPP_NUMBER not configured');
      return false;
    }

    const message = `
🍫 *NutraNoir - New Order*

*Order Reference:* ${order.order_ref}
*Customer:* ${customerName}
*Email:* ${customerEmail}
*Phone:* ${order.shipping_address.phone}

*Total:* Rs. ${parseFloat(order.total_amount).toFixed(2)}
*Status:* ${order.status.toUpperCase()}
*Payment:* ${order.payment_status.toUpperCase()}

*Shipping To:*
${order.shipping_address.address}
${order.shipping_address.city}, ${order.shipping_address.postal_code}

📦 Items: ${order.items.length} product(s)
    `.trim();

    // If Twilio is configured, send real WhatsApp message
    if (twilioClient) {
      try {
        await twilioClient.messages.create({
          from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
          to: `whatsapp:${adminNumber}`,
          body: message,
        });
        console.log(`✅ WhatsApp message sent to ${adminNumber}`);
        return true;
      } catch (twilioError) {
        console.error('❌ Twilio WhatsApp error:', twilioError.message);
        // Fall through to logging
      }
    }

    // Fallback: Console logging (for development/testing)
    console.log('\n' + '='.repeat(60));
    console.log('📱 WHATSAPP MESSAGE (Console Log - Testing Mode)');
    console.log('='.repeat(60));
    console.log(`To: ${adminNumber}`);
    console.log('---');
    console.log(message);
    console.log('='.repeat(60) + '\n');

    return true;
  } catch (error) {
    console.error('❌ Error sending WhatsApp notification:', error.message);
    return false;
  }
};

// Send order status update via WhatsApp to customer (optional)
const sendStatusUpdateWhatsApp = async (order, customerPhone) => {
  try {
    const statusEmojis = {
      pending: '⏳',
      confirmed: '✅',
      shipped: '🚚',
      delivered: '📦',
      cancelled: '❌',
    };

    const message = `
${statusEmojis[order.status] || '📬'} *NutraNoir Order Update*

Your order *${order.order_ref}* is now: *${order.status.toUpperCase()}*

Thank you for shopping with NutraNoir! 🍫
    `.trim();

    // If Twilio is configured
    if (twilioClient) {
      try {
        await twilioClient.messages.create({
          from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
          to: `whatsapp:${customerPhone}`,
          body: message,
        });
        console.log(`✅ Customer status update sent to ${customerPhone}`);
        return true;
      } catch (twilioError) {
        console.error('❌ Twilio error:', twilioError.message);
      }
    }

    // Fallback: Console logging
    console.log('\n' + '='.repeat(60));
    console.log('📱 WHATSAPP MESSAGE TO CUSTOMER (Testing Mode)');
    console.log('='.repeat(60));
    console.log(`To: ${customerPhone}`);
    console.log('---');
    console.log(message);
    console.log('='.repeat(60) + '\n');

    return true;
  } catch (error) {
    console.error('❌ Error sending status WhatsApp:', error.message);
    return false;
  }
};

module.exports = {
  initializeWhatsAppService,
  sendOrderNotificationWhatsApp,
  sendStatusUpdateWhatsApp,
};
