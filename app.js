require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./db/database');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', apiRoutes);

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/bkash', (req, res) => res.sendFile(path.join(__dirname, 'public', 'bkash.html')));
app.get('/nagad', (req, res) => res.sendFile(path.join(__dirname, 'public', 'nagad.html')));
app.get('/success', (req, res) => res.sendFile(path.join(__dirname, 'public', 'success.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/docs', (req, res) => res.sendFile(path.join(__dirname, 'public', 'docs.html')));
app.get('/payment', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.get('/embed.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, 'public', 'embed.js'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Payment Gateway running on port ${PORT}`);
  });
}).catch(err => {
  console.error('DB init failed:', err.message);
  app.listen(PORT, '0.0.0.0', () => console.log(`Running without DB on port ${PORT}`));
});
