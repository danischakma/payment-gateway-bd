const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL not set. Database features will not work.');
}

const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
}) : null;

async function initDB() {
  if (!pool) {
    console.warn('Skipping DB init — no DATABASE_URL configured.');
    return;
  }
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_id VARCHAR(20) UNIQUE NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        product_name VARCHAR(255) DEFAULT 'My Product',
        customer_email VARCHAR(255),
        payment_method VARCHAR(20) DEFAULT 'bkash',
        submitted_trx_id VARCHAR(100),
        matched_trx_id VARCHAR(100),
        status VARCHAR(20) DEFAULT 'pending',
        sms_data TEXT,
        callback_url TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS sms_log (
        id SERIAL PRIMARY KEY,
        raw_message TEXT NOT NULL,
        extracted_trx_id VARCHAR(100),
        extracted_amount DECIMAL(10,2),
        sender VARCHAR(50),
        received_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS gateway_config (
        key VARCHAR(50) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`
      INSERT INTO gateway_config (key, value) VALUES
        ('bkash_number', '01712-345678'),
        ('nagad_number', '01812-345678')
      ON CONFLICT (key) DO NOTHING
    `);
    console.log('Database initialized successfully');
  } finally {
    client.release();
  }
}

async function generateOrderId() {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yy = String(today.getFullYear()).slice(-2);
  const dateStr = dd + mm + yy;
  const result = await pool.query(
    `SELECT COUNT(*) FROM orders WHERE order_id LIKE $1`,
    [`ORD-${dateStr}-%`]
  );
  const count = parseInt(result.rows[0].count) + 1;
  return `ORD-${dateStr}-${String(count).padStart(4, '0')}`;
}

async function getConfig(key) {
  if (!pool) return null;
  const r = await pool.query('SELECT value FROM gateway_config WHERE key = $1', [key]);
  return r.rows[0]?.value || null;
}

async function setConfig(key, value) {
  if (!pool) return;
  await pool.query(
    `INSERT INTO gateway_config (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [key, value]
  );
}

module.exports = { pool, initDB, generateOrderId, getConfig, setConfig };
