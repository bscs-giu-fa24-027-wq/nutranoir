const https = require('https');

// Send email via Brevo API (HTTP - works on Railway)
const sendBrevoEmail = async (to, toName, subject, htmlContent) => {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn('⚠️ BREVO_API_KEY not set');
    return false;
  }

  const data = JSON.stringify({
    sender: { name: 'NutraNoir', email: 'shahidburhan37@gmail.com' },
    to: [{ email: to, name: toName }],
    subject,
    htmlContent
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.brevo.com',
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`✅ Email sent to ${to}`);
          resolve(true);
        } else {
          console.error(`❌ Brevo API error ${res.statusCode}:`, body);
          resolve(false);
        }
      });
    });
    req.on('error', (e) => {
      console.error('❌ Email request error:', e.message);
      resolve(false);
    });
    req.write(data);
    req.end();
  });
};

const initializeEmailService = () => {
  if (process.env.BREVO_API_KEY) {
    console.log('✅ Brevo email service initialized');
  } else {
    console.warn('⚠️ BREVO_API_KEY not configured');
  }
};

// Send order confirmation to customer
const sendCustomerOrderEmail = async (order, customerEmail, customerName) => {
  if (!customerEmail) return false;
  try {
    const itemsHtml = order.items.map(item => `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #ddd;">${item.name}</td>
        <td style="padding:10px;border-bottom:1px solid #ddd;text-align:center;">${item.qty}</td>
        <td style="padding:10px;border-bottom:1px solid #ddd;text-align:right;">Rs. ${(item.price * item.qty).toFixed(2)}</td>
      </tr>`).join('');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:linear-gradient(135deg,#1a1a1a,#3d2817);padding:20px;text-align:center;color:#d4af37;border-radius:5px 5px 0 0;">
          <h1 style="margin:0;">🍫 NutraNoir</h1>
          <p style="margin:5px 0 0;font-size:12px;">Where science meets indulgence</p>
        </div>
        <div style="padding:30px;background:#f9f9f9;border-radius:0 0 5px 5px;">
          <h2 style="color:#1a1a1a;">Order Confirmed! ✓</h2>
          <p>Hi ${customerName},</p>
          <p>Thank you for your order!</p>
          <div style="background:white;padding:20px;border-radius:5px;margin:20px 0;">
            <p><strong>Order Reference:</strong> ${order.order_ref}</p>
            <p><strong>Status:</strong> <span style="color:#d4af37;font-weight:bold;">PENDING</span></p>
            <p><strong>Payment:</strong> ${order.payment_method?.toUpperCase() || 'COD'}</p>
          </div>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#d4af37;color:#1a1a1a;">
                <th style="padding:10px;text-align:left;">Product</th>
                <th style="padding:10px;text-align:center;">Qty</th>
                <th style="padding:10px;text-align:right;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
              <tr style="background:#f0f0f0;font-weight:bold;">
                <td colspan="2" style="padding:10px;text-align:right;">Total:</td>
                <td style="padding:10px;text-align:right;color:#d4af37;font-size:18px;">Rs. ${parseFloat(order.total_amount).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          <div style="margin-top:20px;">
            <h3>Shipping To:</h3>
            <p>${order.shipping_address.name}<br>${order.shipping_address.phone}<br>${order.shipping_address.address}<br>${order.shipping_address.city}</p>
          </div>
          <p style="margin-top:30px;color:#666;font-size:12px;text-align:center;">Questions? Contact us at support@nutranoir.com</p>
        </div>
      </div>`;

    return await sendBrevoEmail(customerEmail, customerName, `✓ Order Confirmed - ${order.order_ref}`, html);
  } catch (err) {
    console.error('❌ Error sending customer email:', err.message);
    return false;
  }
};

// Send new order notification to admin
const sendAdminOrderEmail = async (order, customerName, customerEmail) => {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.CUSTOMER_EMAIL;
  if (!adminEmail) return false;
  try {
    const itemsHtml = order.items.map(item =>
      `<li>${item.name} x ${item.qty} = Rs. ${(item.price * item.qty).toFixed(2)}</li>`
    ).join('');

    const html = `
      <div style="font-family:Arial,sans-serif;padding:20px;background:#f9f9f9;">
        <h2 style="color:#d4af37;">🎉 New Order Received!</h2>
        <div style="background:white;padding:20px;border-radius:5px;">
          <p><strong>Order Ref:</strong> ${order.order_ref}</p>
          <p><strong>Customer:</strong> ${customerName} (${customerEmail})</p>
          <p><strong>Phone:</strong> ${order.shipping_address?.phone}</p>
          <p><strong>Total:</strong> Rs. ${parseFloat(order.total_amount).toFixed(2)}</p>
          <p><strong>Payment:</strong> ${order.payment_method?.toUpperCase()}</p>
          <p><strong>Address:</strong> ${order.shipping_address?.address}, ${order.shipping_address?.city}</p>
        </div>
        <h3>Items:</h3>
        <ul>${itemsHtml}</ul>
        <p><a href="https://nutranoir-production.up.railway.app/admin" style="background:#d4af37;color:#1a1a1a;padding:10px 20px;text-decoration:none;border-radius:5px;font-weight:bold;">View Admin Dashboard</a></p>
      </div>`;

    return await sendBrevoEmail(adminEmail, 'NutraNoir Admin', `📦 New Order - ${order.order_ref}`, html);
  } catch (err) {
    console.error('❌ Error sending admin email:', err.message);
    return false;
  }
};

// Send status update email to customer
const sendOrderStatusEmail = async (order, customerEmail, customerName) => {
  if (!customerEmail) return false;
  try {
    const statusMessages = {
      confirmed: 'Your order has been confirmed and is being prepared.',
      shipped: 'Your order has been shipped! 🚚',
      delivered: 'Your order has been delivered. Thank you! 🍫',
      cancelled: 'Your order has been cancelled.',
    };

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:linear-gradient(135deg,#1a1a1a,#3d2817);padding:20px;text-align:center;color:#d4af37;border-radius:5px 5px 0 0;">
          <h1 style="margin:0;">🍫 NutraNoir</h1>
        </div>
        <div style="padding:30px;background:#f9f9f9;border-radius:0 0 5px 5px;">
          <h2>Order Status Update</h2>
          <p>Hi ${customerName},</p>
          <div style="background:#d4af37;color:#1a1a1a;padding:20px;border-radius:5px;text-align:center;">
            <h3 style="margin:0;font-size:24px;">${order.status?.toUpperCase()}</h3>
          </div>
          <p style="margin-top:20px;">${statusMessages[order.status] || 'Your order status has been updated.'}</p>
          <p><strong>Order Reference:</strong> ${order.order_ref}</p>
        </div>
      </div>`;

    return await sendBrevoEmail(customerEmail, customerName, `📬 Order Update - ${order.order_ref}`, html);
  } catch (err) {
    console.error('❌ Error sending status email:', err.message);
    return false;
  }
};

module.exports = {
  initializeEmailService,
  sendCustomerOrderEmail,
  sendAdminOrderEmail,
  sendOrderStatusEmail,
};
