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
        customer_email VARCHAR(255) NOT NULL,
        payment_method VARCHAR(20) DEFAULT 'bkash',
        trx_id VARCHAR(100),
        status VARCHAR(20) DEFAULT 'pending',
        sms_data TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
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

module.exports = { pool, initDB, generateOrderId };
