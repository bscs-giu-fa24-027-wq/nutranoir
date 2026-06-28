const nodemailer = require('nodemailer');

let transporter = null;

// Initialize Brevo (Sendinblue) transporter
const initializeEmailService = () => {
  const user = process.env.BREVO_USER || process.env.GMAIL_USER;
  const pass = process.env.BREVO_PASSWORD || process.env.GMAIL_PASSWORD;

  if (!user || !pass) {
    console.warn('⚠️ Email credentials not configured. Email notifications will be skipped.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.BREVO_HOST || 'smtp-relay.brevo.com',
    port: parseInt(process.env.BREVO_PORT) || 587,
    secure: false,
    auth: { user, pass },
  });

  console.log('✅ Brevo email service initialized');
  return transporter;
};

// Send order confirmation email to customer
const sendCustomerOrderEmail = async (order, customerEmail, customerName) => {
  if (!transporter) transporter = initializeEmailService();
  if (!transporter) return false;

  try {
    const itemsHtml = order.items
      .map(item => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.name}</td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center;">Qty: ${item.qty}</td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">Rs. ${(item.price * item.qty).toFixed(2)}</td>
        </tr>
      `)
      .join('');

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1a1a1a 0%, #3d2817 100%); padding: 20px; text-align: center; color: #d4af37; border-radius: 5px 5px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">🍫 NutraNoir</h1>
          <p style="margin: 5px 0 0 0; font-size: 12px;">Where science meets indulgence</p>
        </div>
        <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 5px 5px;">
          <h2 style="color: #1a1a1a; margin-top: 0;">Order Confirmation</h2>
          <p>Hi ${customerName},</p>
          <p>Thank you for your order! Here are the details:</p>
          <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Order Reference:</strong> ${order.order_ref}</p>
            <p><strong>Order Date:</strong> ${new Date(order.created_at).toLocaleDateString('en-US')}</p>
            <p><strong>Status:</strong> <span style="color: #d4af37; font-weight: bold;">${order.status.toUpperCase()}</span></p>
          </div>
          <h3 style="color: #1a1a1a;">Order Items</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #d4af37; color: #1a1a1a;">
                <th style="padding: 10px; text-align: left;">Product</th>
                <th style="padding: 10px; text-align: center;">Quantity</th>
                <th style="padding: 10px; text-align: right;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
              <tr style="background: #f0f0f0; font-weight: bold;">
                <td colspan="2" style="padding: 10px; text-align: right;">Total:</td>
                <td style="padding: 10px; text-align: right; color: #d4af37; font-size: 18px;">Rs. ${parseFloat(order.total_amount).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          <h3 style="color: #1a1a1a;">Shipping Address</h3>
          <p>
            ${order.shipping_address.name}<br>
            ${order.shipping_address.phone}<br>
            ${order.shipping_address.address}<br>
            ${order.shipping_address.city}
          </p>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 12px;">
            <p>You will receive another email when your order is shipped.</p>
            <p>Questions? Contact us at support@nutranoir.com</p>
          </div>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"NutraNoir" <${process.env.BREVO_USER || process.env.GMAIL_USER}>`,
      to: customerEmail,
      subject: `✓ Order Confirmed - NutraNoir ${order.order_ref}`,
      html: htmlContent,
    });

    console.log(`✅ Customer email sent to ${customerEmail}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending customer email:', error.message);
    return false;
  }
};

// Send order notification email to admin
const sendAdminOrderEmail = async (order, customerName, customerEmail) => {
  if (!transporter) transporter = initializeEmailService();
  if (!transporter) return false;

  try {
    const itemsHtml = order.items
      .map(item => `<li>${item.name} x ${item.qty} = Rs. ${(item.price * item.qty).toFixed(2)}</li>`)
      .join('');

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 20px;">
        <h2 style="color: #d4af37;">🎉 New Order Received!</h2>
        <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Order Reference:</strong> ${order.order_ref}</p>
          <p><strong>Customer Name:</strong> ${customerName}</p>
          <p><strong>Customer Email:</strong> ${customerEmail}</p>
          <p><strong>Phone:</strong> ${order.shipping_address.phone}</p>
          <p><strong>Total Amount:</strong> Rs. ${parseFloat(order.total_amount).toFixed(2)}</p>
          <p><strong>Payment Method:</strong> ${order.payment_method?.toUpperCase()}</p>
          <p><strong>Status:</strong> ${order.status.toUpperCase()}</p>
        </div>
        <h3>Items:</h3>
        <ul>${itemsHtml}</ul>
        <h3>Shipping Address:</h3>
        <p>
          ${order.shipping_address.name}<br>
          ${order.shipping_address.address}<br>
          ${order.shipping_address.city}
        </p>
        <p style="margin-top: 30px;">
          <a href="https://nutranoir-production.up.railway.app/admin" style="background: #d4af37; color: #1a1a1a; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">View in Admin Dashboard</a>
        </p>
      </div>
    `;

    await transporter.sendMail({
      from: `"NutraNoir" <${process.env.BREVO_USER || process.env.GMAIL_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject: `📦 New Order - ${order.order_ref}`,
      html: htmlContent,
    });

    console.log(`✅ Admin email sent to ${process.env.ADMIN_EMAIL}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending admin email:', error.message);
    return false;
  }
};

// Send order status update email
const sendOrderStatusEmail = async (order, customerEmail, customerName) => {
  if (!transporter) transporter = initializeEmailService();
  if (!transporter) return false;

  try {
    const statusMessages = {
      confirmed: 'Your order has been confirmed and is being prepared.',
      shipped: 'Your order has been shipped!',
      delivered: 'Your order has been delivered. Thank you for shopping with NutraNoir!',
      cancelled: 'Your order has been cancelled.',
    };

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1a1a1a 0%, #3d2817 100%); padding: 20px; text-align: center; color: #d4af37; border-radius: 5px 5px 0 0;">
          <h1 style="margin: 0;">🍫 NutraNoir</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 5px 5px;">
          <h2 style="color: #1a1a1a;">Order Status Update</h2>
          <p>Hi ${customerName},</p>
          <div style="background: #d4af37; color: #1a1a1a; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center;">
            <h3 style="margin: 0; font-size: 24px;">${order.status.toUpperCase()}</h3>
          </div>
          <p>${statusMessages[order.status] || 'Your order status has been updated.'}</p>
          <p><strong>Order Reference:</strong> ${order.order_ref}</p>
          <p style="margin-top: 30px; color: #666; font-size: 12px;">
            Questions? Contact us at support@nutranoir.com
          </p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"NutraNoir" <${process.env.BREVO_USER || process.env.GMAIL_USER}>`,
      to: customerEmail,
      subject: `📬 Order Status Update - ${order.order_ref}`,
      html: htmlContent,
    });

    console.log(`✅ Status update email sent to ${customerEmail}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending status email:', error.message);
    return false;
  }
};

module.exports = {
  initializeEmailService,
  sendCustomerOrderEmail,
  sendAdminOrderEmail,
  sendOrderStatusEmail,
};
