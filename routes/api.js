const express = require('express');
const router = express.Router();
const db = require('../db/database');

function getPool() {
  if (!db.pool) throw new Error('Database not configured. Set DATABASE_URL environment variable.');
  return db.pool;
}

function checkAdmin(req, res) {
  const token = (req.headers['authorization'] || req.query.token || '').replace('Bearer ', '');
  if (!token || token !== process.env.ADMIN_TOKEN) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return false;
  }
  return true;
}

router.post('/initiate', async (req, res) => {
  const { amount, product_name, payment_method, customer_email, callback_url } = req.body;
  if (!amount) return res.status(400).json({ success: false, message: 'Amount is required' });
  if (isNaN(amount) || parseFloat(amount) <= 0) return res.status(400).json({ success: false, message: 'Invalid amount' });

  try {
    const pool = getPool();
    const orderId = await db.generateOrderId();
    const method = payment_method === 'nagad' ? 'nagad' : 'bkash';
    await pool.query(
      `INSERT INTO orders (order_id, amount, product_name, customer_email, payment_method, callback_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
      [orderId, parseFloat(amount), product_name || 'My Product', customer_email || '', method, callback_url || '']
    );
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
    res.json({
      success: true,
      order_id: orderId,
      payment_url: `${baseUrl}/?order_id=${orderId}&product=${encodeURIComponent(product_name || 'My Product')}&amount=${amount}`
    });
  } catch (err) {
    console.error('Initiate error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/submit-trx', async (req, res) => {
  const { order_id, trx_id } = req.body;
  if (!order_id || !trx_id) return res.status(400).json({ success: false, message: 'order_id and trx_id required' });

  try {
    const pool = getPool();
    const orderRes = await pool.query('SELECT * FROM orders WHERE order_id = $1', [order_id]);
    if (!orderRes.rows.length) return res.status(404).json({ success: false, message: 'Order not found' });
    const order = orderRes.rows[0];
    if (order.status === 'completed') return res.json({ success: true, status: 'completed', message: 'Already verified' });

    await pool.query(
      `UPDATE orders SET submitted_trx_id = $1, updated_at = NOW() WHERE order_id = $2`,
      [trx_id.trim().toUpperCase(), order_id]
    );

    const smsRes = await pool.query(
      `SELECT * FROM sms_log WHERE UPPER(extracted_trx_id) = $1 ORDER BY received_at DESC LIMIT 1`,
      [trx_id.trim().toUpperCase()]
    );

    if (smsRes.rows.length > 0) {
      const sms = smsRes.rows[0];
      await pool.query(
        `UPDATE orders SET matched_trx_id = $1, status = 'completed', sms_data = $2, updated_at = NOW() WHERE order_id = $3`,
        [sms.extracted_trx_id, sms.raw_message, order_id]
      );
      notifyCallback(order.callback_url, order_id, 'completed');
      return res.json({ success: true, status: 'completed' });
    }

    res.json({ success: true, status: 'pending', message: 'Waiting for SMS confirmation' });
  } catch (err) {
    console.error('Submit TRX error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/poll-verification', async (req, res) => {
  const { order_id } = req.query;
  if (!order_id) return res.status(400).json({ success: false, message: 'order_id required' });
  try {
    const pool = getPool();
    const orderRes = await pool.query('SELECT * FROM orders WHERE order_id = $1', [order_id]);
    if (!orderRes.rows.length) return res.status(404).json({ success: false, message: 'Order not found' });
    const order = orderRes.rows[0];

    if (order.status === 'completed') return res.json({ success: true, status: 'completed' });

    if (order.submitted_trx_id) {
      const smsRes = await pool.query(
        `SELECT * FROM sms_log WHERE UPPER(extracted_trx_id) = $1 ORDER BY received_at DESC LIMIT 1`,
        [order.submitted_trx_id.toUpperCase()]
      );
      if (smsRes.rows.length > 0) {
        const sms = smsRes.rows[0];
        await pool.query(
          `UPDATE orders SET matched_trx_id = $1, status = 'completed', sms_data = $2, updated_at = NOW() WHERE order_id = $3`,
          [sms.extracted_trx_id, sms.raw_message, order_id]
        );
        notifyCallback(order.callback_url, order_id, 'completed');
        return res.json({ success: true, status: 'completed' });
      }
    }
    res.json({ success: true, status: 'pending' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/webhook/sms', async (req, res) => {
  const message = req.body.message || req.body.text || req.body.body || req.body.msg || '';
  const sender  = req.body.sender || req.body.from || req.body.originator || req.body.phone || '';
  const order_id = req.body.order_id || '';
  if (!message) return res.status(400).json({ success: false, message: 'message or text field required' });

  const trxMatch = message.match(/\b([A-Z0-9]{6,12})\b/g);
  const amountMatch = message.match(/Tk\.?\s*([\d,]+\.?\d*)/i);
  const extractedTrxId = trxMatch ? trxMatch.find(t => t.length >= 6) : null;
  const extractedAmount = amountMatch ? parseFloat(amountMatch[1].replace(',', '')) : null;

  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO sms_log (raw_message, extracted_trx_id, extracted_amount, sender) VALUES ($1, $2, $3, $4)`,
      [message, extractedTrxId, extractedAmount, sender || '']
    );

    let updated = false;
    if (extractedTrxId) {
      const matchRes = await pool.query(
        `SELECT * FROM orders WHERE UPPER(submitted_trx_id) = $1 AND status = 'pending'`,
        [extractedTrxId.toUpperCase()]
      );
      if (matchRes.rows.length > 0) {
        const ord = matchRes.rows[0];
        await pool.query(
          `UPDATE orders SET matched_trx_id = $1, status = 'completed', sms_data = $2, updated_at = NOW() WHERE order_id = $3`,
          [extractedTrxId, message, ord.order_id]
        );
        notifyCallback(ord.callback_url, ord.order_id, 'completed');
        updated = true;
      } else if (extractedAmount) {
        const amtRes = await pool.query(
          `SELECT * FROM orders WHERE amount = $1 AND status = 'pending' AND submitted_trx_id IS NOT NULL ORDER BY created_at DESC LIMIT 1`,
          [extractedAmount]
        );
        if (amtRes.rows.length > 0) {
          const ord = amtRes.rows[0];
          await pool.query(
            `UPDATE orders SET matched_trx_id = $1, status = 'completed', sms_data = $2, updated_at = NOW() WHERE order_id = $3`,
            [extractedTrxId, message, ord.order_id]
          );
          notifyCallback(ord.callback_url, ord.order_id, 'completed');
          updated = true;
        }
      }
    }

    res.json({ success: true, extracted_trx_id: extractedTrxId, extracted_amount: extractedAmount, order_updated: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

function notifyCallback(url, orderId, status) {
  if (!url) return;
  const https = require('https');
  const http = require('http');
  try {
    const data = JSON.stringify({ order_id: orderId, status });
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const options = { hostname: parsed.hostname, path: parsed.pathname, port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80), method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } };
    const req = mod.request(options);
    req.on('error', () => {});
    req.write(data);
    req.end();
  } catch {}
}

router.get('/order-status', async (req, res) => {
  const { order_id } = req.query;
  if (!order_id) return res.status(400).json({ success: false, message: 'order_id required' });
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT order_id, amount, product_name, customer_email, payment_method, submitted_trx_id, matched_trx_id, status, created_at, updated_at FROM orders WHERE order_id = $1`,
      [order_id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, order: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/config', async (req, res) => {
  try {
    const bkash = await db.getConfig('bkash_number') || process.env.BKASH_NUMBER || '01712-345678';
    const nagad = await db.getConfig('nagad_number') || process.env.NAGAD_NUMBER || '01812-345678';
    res.json({ success: true, bkash, nagad });
  } catch {
    res.json({ success: true, bkash: process.env.BKASH_NUMBER || '01712-345678', nagad: process.env.NAGAD_NUMBER || '01812-345678' });
  }
});

router.post('/admin/update-config', async (req, res) => {
  if (!checkAdmin(req, res)) return;
  const { bkash_number, nagad_number } = req.body;
  try {
    if (bkash_number) await db.setConfig('bkash_number', bkash_number);
    if (nagad_number) await db.setConfig('nagad_number', nagad_number);
    res.json({ success: true, message: 'Config updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/admin/orders', async (req, res) => {
  if (!checkAdmin(req, res)) return;
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  try {
    const pool = getPool();
    const params = [];
    let where = '';
    if (status) { params.push(status); where = `WHERE status = $1`; }
    params.push(parseInt(limit), offset);
    const dataQ = `SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const countParams = status ? [status] : [];
    const countQ = `SELECT COUNT(*) FROM orders ${status ? 'WHERE status = $1' : ''}`;
    const [data, count] = await Promise.all([pool.query(dataQ, params), pool.query(countQ, countParams)]);
    res.json({ success: true, total: parseInt(count.rows[0].count), page: parseInt(page), limit: parseInt(limit), orders: data.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/admin/sms-log', async (req, res) => {
  if (!checkAdmin(req, res)) return;
  const { limit = 30 } = req.query;
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT sl.*, o.order_id as matched_order_id
       FROM sms_log sl
       LEFT JOIN orders o ON UPPER(o.matched_trx_id) = UPPER(sl.extracted_trx_id) AND o.status = 'completed'
       ORDER BY sl.received_at DESC
       LIMIT $1`,
      [parseInt(limit)]
    );
    res.json({ success: true, logs: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
