const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');
const supabase = require('../supabase');
const auth = require('../middleware/authMiddleware');

// ── GENERATE HASH (JazzCash HMAC SHA256) ─────────────────
function generateHash(params, integrityKey) {
  // Sort keys alphabetically, build string
  const sorted = Object.keys(params).sort();
  const hashString = integrityKey + '&' + sorted.map(k => params[k]).join('&');
  return crypto.createHmac('sha256', integrityKey).update(hashString).digest('hex').toUpperCase();
}

// ── INITIATE PAYMENT ──────────────────────────────────────
router.post('/initiate', auth, async (req, res) => {
  const { order_id, order_ref, amount, phone_number } = req.body;

  if (!order_id || !amount || !phone_number) {
    return res.status(400).json({ error: 'order_id, amount, and phone_number required.' });
  }

  try {
    const txnDateTime = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const txnRefNo = 'T' + txnDateTime + Math.floor(Math.random() * 1000);
    const amountStr = (parseFloat(amount) * 100).toFixed(0); // JazzCash uses paisas

    const params = {
      pp_Version: '2.0',
      pp_TxnType: 'MWALLET',
      pp_Language: 'EN',
      pp_MerchantID: process.env.JAZZCASH_MERCHANT_ID,
      pp_SubMerchantID: '',
      pp_Password: process.env.JAZZCASH_PASSWORD,
      pp_BankID: 'TBANK',
      pp_ProductID: 'RETL',
      pp_TxnRefNo: txnRefNo,
      pp_Amount: amountStr,
      pp_TxnCurrency: 'PKR',
      pp_TxnDateTime: txnDateTime,
      pp_BillReference: order_ref || 'NutraNoir-' + order_id,
      pp_Description: 'NutraNoir Order Payment',
      pp_TxnExpiryDateTime: new Date(Date.now() + 3600000).toISOString().replace(/[-:T.Z]/g, '').slice(0, 14),
      pp_ReturnURL: process.env.JAZZCASH_RETURN_URL,
      pp_SecureHash: '',
      ppmpf_1: req.user.id,
      ppmpf_2: order_id,
      ppmpf_3: '',
      ppmpf_4: '',
      ppmpf_5: ''
    };

    // Remove pp_SecureHash before hashing
    const { pp_SecureHash, ...hashParams } = params;
    params.pp_SecureHash = generateHash(hashParams, process.env.JAZZCASH_INTEGRITY_SALT);

    // Save txn ref in order
    await supabase
      .from('orders')
      .update({ jazzcash_txn_ref: txnRefNo, payment_status: 'initiated' })
      .eq('id', order_id);

    // Call JazzCash Sandbox API
    const response = await axios.post(process.env.JAZZCASH_API_URL, params, {
      headers: { 'Content-Type': 'application/json' }
    });

    const jcData = response.data;

    // pp_ResponseCode 000 = success
    if (jcData.pp_ResponseCode === '000') {
      // Mark order as paid
      await supabase
        .from('orders')
        .update({ payment_status: 'paid', status: 'confirmed' })
        .eq('id', order_id);

      res.json({
        success: true,
        message: 'Payment successful.',
        txn_ref: txnRefNo,
        jazzcash_response: jcData
      });
    } else {
      res.status(400).json({
        success: false,
        message: jcData.pp_ResponseMessage || 'Payment failed.',
        code: jcData.pp_ResponseCode
      });
    }

  } catch (err) {
    console.error('JazzCash error:', err.message);
    res.status(500).json({ error: 'Payment processing failed.' });
  }
});

// ── PAYMENT CALLBACK (JazzCash redirects here) ────────────
router.post('/callback', async (req, res) => {
  const data = req.body;

  try {
    if (data.pp_ResponseCode === '000') {
      const order_id = data.ppmpf_2;

      await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          status: 'confirmed',
          jazzcash_txn_ref: data.pp_TxnRefNo
        })
        .eq('id', order_id);

      // Redirect to confirmation page
      return res.redirect(`/order-confirmation.html?order=${order_id}&status=success`);
    } else {
      return res.redirect(`/order-confirmation.html?status=failed`);
    }
  } catch (err) {
    console.error('Callback error:', err);
    res.redirect('/order-confirmation.html?status=error');
  }
});

// ── CHECK PAYMENT STATUS ──────────────────────────────────
router.get('/status/:order_id', auth, async (req, res) => {
  try {
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, order_ref, payment_status, status, total_amount')
      .eq('id', req.params.order_id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !order) return res.status(404).json({ error: 'Order not found.' });

    res.json({ payment_status: order.payment_status, order_status: order.status, order });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check status.' });
  }
});

module.exports = router;
