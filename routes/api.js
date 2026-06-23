const express = require('express');
const router = express.Router();
const db = require('../db/database');

function getPool() {
  if (!db.pool) {
    throw new Error('Database not configured. Please set DATABASE_URL environment variable.');
  }
  return db.pool;
}

router.post('/initiate', async (req, res) => {
  const { amount, email, payment_method } = req.body;

  if (!amount || !email) {
    return res.status(400).json({ success: false, message: 'Amount and email are required' });
  }
  if (isNaN(amount) || parseFloat(amount) <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid amount' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, message: 'Invalid email address' });
  }

  try {
    const pool = getPool();
    const orderId = await db.generateOrderId();
    const method = payment_method === 'nagad' ? 'nagad' : 'bkash';

    await pool.query(
      `INSERT INTO orders (order_id, amount, customer_email, payment_method, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [orderId, parseFloat(amount), email.toLowerCase().trim(), method]
    );

    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
    res.json({
      success: true,
      order_id: orderId,
      amount: parseFloat(amount),
      payment_method: method,
      payment_url: `${baseUrl}/payment?order_id=${orderId}`
    });
  } catch (err) {
    console.error('Initiate error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to create order' });
  }
});

router.post('/verify-payment', async (req, res) => {
  const { order_id, trx_id } = req.body;

  if (!order_id || !trx_id) {
    return res.status(400).json({ success: false, message: 'order_id and trx_id are required' });
  }

  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM orders WHERE order_id = $1`,
      [order_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const order = result.rows[0];
    if (order.status === 'completed') {
      return res.json({ success: true, message: 'Payment already verified', order });
    }

    await pool.query(
      `UPDATE orders SET trx_id = $1, status = 'completed', updated_at = NOW() WHERE order_id = $2`,
      [trx_id.trim(), order_id]
    );

    const updated = await pool.query(
      `SELECT * FROM orders WHERE order_id = $1`,
      [order_id]
    );

    res.json({ success: true, message: 'Payment verified successfully', order: updated.rows[0] });
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ success: false, message: err.message || 'Verification failed' });
  }
});

router.post('/webhook/sms', async (req, res) => {
  const { message, order_id } = req.body;

  if (!message) {
    return res.status(400).json({ success: false, message: 'SMS message is required' });
  }

  try {
    const trxMatch = message.match(/\b([A-Z0-9]{8,12})\b/);
    const amountMatch = message.match(/Tk\.?\s*([\d,]+\.?\d*)/i);
    const extractedTrxId = trxMatch ? trxMatch[1] : null;
    const extractedAmount = amountMatch ? parseFloat(amountMatch[1].replace(',', '')) : null;

    let updated = false;
    if (db.pool) {
      const pool = db.pool;
      if (order_id && extractedTrxId) {
        const r = await pool.query(
          `UPDATE orders SET trx_id = $1, status = 'completed', sms_data = $2, updated_at = NOW()
           WHERE order_id = $3 AND status = 'pending' RETURNING order_id`,
          [extractedTrxId, message, order_id]
        );
        updated = r.rowCount > 0;
      } else if (extractedTrxId && extractedAmount) {
        const r = await pool.query(
          `UPDATE orders SET trx_id = $1, status = 'completed', sms_data = $2, updated_at = NOW()
           WHERE amount = $3 AND status = 'pending'
           ORDER BY created_at DESC LIMIT 1 RETURNING order_id`,
          [extractedTrxId, message, extractedAmount]
        );
        updated = r.rowCount > 0;
      }
    }

    res.json({
      success: true,
      message: 'SMS received',
      extracted_trx_id: extractedTrxId,
      extracted_amount: extractedAmount,
      order_updated: updated
    });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ success: false, message: err.message || 'Webhook processing failed' });
  }
});

router.get('/order-status', async (req, res) => {
  const { order_id } = req.query;
  if (!order_id) {
    return res.status(400).json({ success: false, message: 'order_id is required' });
  }

  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT order_id, amount, customer_email, payment_method, trx_id, status, created_at, updated_at
       FROM orders WHERE order_id = $1`,
      [order_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    res.json({ success: true, order: result.rows[0] });
  } catch (err) {
    console.error('Status error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch order status' });
  }
});

router.get('/admin/orders', async (req, res) => {
  const token = req.headers['authorization'] || req.query.token;
  if (!token || token.replace('Bearer ', '') !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const { status, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    const pool = getPool();
    const params = [];
    let whereClause = '';

    if (status) {
      params.push(status);
      whereClause = `WHERE status = $${params.length}`;
    }

    params.push(parseInt(limit), offset);
    const dataQuery = `SELECT * FROM orders ${whereClause} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const countParams = status ? [status] : [];
    const countQuery = `SELECT COUNT(*) FROM orders ${status ? 'WHERE status = $1' : ''}`;

    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, params),
      pool.query(countQuery, countParams)
    ]);

    res.json({
      success: true,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
      orders: dataResult.rows
    });
  } catch (err) {
    console.error('Admin error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch orders' });
  }
});

router.get('/config', (req, res) => {
  res.json({
    bkash: process.env.BKASH_NUMBER || '01XXXXXXXXX',
    nagad: process.env.NAGAD_NUMBER || '01XXXXXXXXX'
  });
});

module.exports = router;
