const express = require('express');
const supabase = require('../supabase');
const verifyToken = require('../middleware/authMiddleware');
const { sendCustomerOrderEmail, sendAdminOrderEmail, sendOrderStatusEmail } = require('../services/emailService');
const { sendOrderNotificationWhatsApp, sendStatusUpdateWhatsApp } = require('../services/whatsappService');
const crypto = require('crypto');

const router = express.Router();

// ── CREATE ORDER ───────────────────────────────────────────
router.post('/create', verifyToken, async (req, res) => {
  try {
    const { items, shipping_address, total_amount, payment_method } = req.body;
    const userId = req.user.id; // ← FIXED: was req.user.userId

    if (!items || !shipping_address || !total_amount) {
      return res.status(400).json({ error: 'Items, shipping address and total are required.' });
    }

    // ── INVENTORY CHECK ───────────────────────────────────
    for (const item of items) {
      const { data: product } = await supabase
        .from('products')
        .select('id, stock, name')
        .ilike('name', item.name)
        .single();

      if (product && product.stock < item.qty) {
        return res.status(400).json({ 
          error: `Sorry, only ${product.stock} units of "${item.name}" available.` 
        });
      }
    }

    // Generate order reference
    const order_ref = 'NN-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

    // Insert order
    const { data: order, error } = await supabase
      .from('orders')
      .insert([{
        user_id: userId,
        order_ref,
        items,
        shipping_address,
        total_amount,
        status: 'pending',
        payment_status: payment_method === 'cod' ? 'unpaid' : 'initiated',
        payment_method: payment_method || 'cod'
      }])
      .select()
      .single();

    if (error) throw error;

    // ── DEDUCT INVENTORY ──────────────────────────────────
    for (const item of items) {
      const { data: p } = await supabase
        .from('products')
        .select('id, stock')
        .ilike('name', item.name)
        .single();
      if (p) {
        await supabase
          .from('products')
          .update({ stock: Math.max(0, p.stock - item.qty) })
          .eq('id', p.id);
      }
    }

    // ── FETCH USER FOR NOTIFICATIONS ──────────────────────
    const { data: userData } = await supabase
      .from('users')
      .select('name, email, phone')
      .eq('id', userId)
      .single();

    const customerName = userData?.name || 'Valued Customer';
    const customerEmail = userData?.email;

    // ── SEND NOTIFICATIONS ────────────────────────────────
    console.log('\n📧 Sending notifications for order:', order_ref);
    await sendCustomerOrderEmail(order, customerEmail, customerName);
    await sendAdminOrderEmail(order, customerName, customerEmail);
    await sendOrderNotificationWhatsApp(order, customerName, customerEmail);

    res.status(201).json({
      success: true,
      order_id: order.id,
      order_ref: order.order_ref,
      message: 'Order created successfully!'
    });

  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET MY ORDERS ──────────────────────────────────────────
router.get('/my-orders', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id; // ← FIXED
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ orders: data });
  } catch (err) {
    console.error('Fetch orders error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET SINGLE ORDER ───────────────────────────────────────
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id; // ← FIXED
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', userId)
      .single();

    if (error || !order) return res.status(404).json({ error: 'Order not found.' });
    res.json({ order });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch order.' });
  }
});

// ── UPDATE STATUS (admin) ──────────────────────────────────
router.patch('/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const { data, error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date() })
      .eq('id', orderId)
      .select('*, users(name, email, phone)')
      .single();

    if (error) throw error;

    const customerEmail = data.users?.email;
    const customerName = data.users?.name || 'Valued Customer';
    const customerPhone = data.users?.phone;

    console.log(`\n📢 Status update: ${data.order_ref} → ${status.toUpperCase()}`);
    await sendOrderStatusEmail(data, customerEmail, customerName);
    await sendStatusUpdateWhatsApp(data, customerPhone);

    res.json(data);
  } catch (err) {
    console.error('Update order error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET PRODUCTS (with stock) ──────────────────────────────
router.get('/products/all', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .order('name');

    if (error) throw error;
    res.json({ products: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
