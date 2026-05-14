const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { sendEmailReminders } = require('./emailReminders');

require("dotenv").config({ quiet: true });
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const app = express();  
app.use(cors());
app.use(express.json());


const emailsPath = path.join(__dirname, 'data', 'emails.json');
const emailsSentPath = path.join(__dirname, 'data', 'emailsSent.json');

// Reset emails and sent records on server start
fs.writeFileSync(emailsPath, JSON.stringify([], null, 2), 'utf-8');
fs.writeFileSync(emailsSentPath, JSON.stringify([], null, 2), 'utf-8');
console.log('emails.json and emailsSent.json have been reset on server start');

// Serve static frontend files from the project root
app.use(express.static(path.join(__dirname)));

// Root route: send the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'HTMLtest.html'));
});

// Data file for email subscriptions only
const DATA_DIR = path.join(__dirname, 'data');

//console.log("USER1_NAME:", process.env.USER1_NAME);
//console.log("USER1_PASS:", process.env.USER1_PASS);

const VALID_USERS = {
  [process.env.USER1_NAME]: process.env.USER1_PASS,
  [process.env.USER2_NAME]: process.env.USER2_PASS
};

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeSubscriptionRow(row) {
  return {
    ...row,
    id: Number(row.id),
    amount: toNumberOrNull(row.amount),
    amountPerCycle: toNumberOrNull(row.amountPerCycle),
    personalValue: toNumberOrNull(row.personalValue)
  };
}

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    console.log(`[API] ${req.method} ${req.path}`, req.method === 'GET' ? '' : req.body || '');
    const startedAt = Date.now();
    res.on('finish', () => {
      console.log(`[API] ${req.method} ${req.path} -> ${res.statusCode} (${Date.now() - startedAt}ms)`);
    });
  }
  next();
});

async function ensureSubscriptionsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id BIGINT PRIMARY KEY,
      name TEXT NOT NULL,
      amount NUMERIC(10, 2),
      date TEXT,
      "subscriptionType" TEXT,
      color TEXT,
      "isTrial" BOOLEAN DEFAULT FALSE,
      "billingCycle" TEXT DEFAULT 'Monthly',
      "amountPerCycle" NUMERIC(10, 2),
      "personalValue" SMALLINT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

async function ensureAccountsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS accounts (
      id BIGSERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (char_length(username) >= 3),
      CHECK (position('@' in email) > 1)
    )
  `);
}

async function ensureDbTestTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS db_smoke_test (
      id SERIAL PRIMARY KEY,
      label TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

function capitalizeWords(str) {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Login endpoint
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (VALID_USERS[username] && VALID_USERS[username] === password) {
        return res.json({ success: true, user: username });
    }
    return res.json({ success: false });
});

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Get all subscriptions from database
app.get('/api/subscriptions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM subscriptions ORDER BY created_at DESC');
    const rows = result.rows.map(normalizeSubscriptionRow);
    console.log(`[DB] fetched ${rows.length} subscriptions`);
    res.json(rows);
  } catch (err) {
    console.error('Failed to fetch subscriptions:', err.message);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

// Add a subscription to database
app.post('/api/subscriptions', async (req, res) => {
  const sub = req.body;
  if (!sub.name) return res.status(400).json({ error: 'name required' });
  if (!sub.id) return res.status(400).json({ error: 'id required' });

  const name = capitalizeWords(sub.name);
  const amount = sub.amount ?? null;
  const date = sub.date ?? null;
  const subscriptionType = sub.subscriptionType ?? null;
  const color = sub.color ?? null;
  const isTrial = sub.isTrial ?? false;
  const billingCycle = sub.billingCycle ?? 'Monthly';
  const amountPerCycle = sub.amountPerCycle ?? null;
  const personalValue = sub.personalValue ?? null;

  try {
    const result = await pool.query(
      `INSERT INTO subscriptions (id, name, amount, date, "subscriptionType", color, "isTrial", "billingCycle", "amountPerCycle", "personalValue")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [sub.id, name, amount, date, subscriptionType, color, isTrial, billingCycle, amountPerCycle, personalValue]
    );
    const savedRow = normalizeSubscriptionRow(result.rows[0]);
    console.log('[DB] saved subscription:', savedRow);
    res.status(201).json(savedRow);
  } catch (err) {
    console.error('Failed to insert subscription:', {
      code: err.code,
      message: err.message,
      detail: err.detail,
      constraint: err.constraint,
      table: err.table,
      column: err.column
    });
    res.status(500).json({
      error: 'Failed to insert subscription',
      details: err.message,
      code: err.code
    });
  }
});

// Delete a subscription by id
app.delete('/api/subscriptions/:id', async (req, res) => {
  const id = req.params.id;

  try {
    const result = await pool.query('DELETE FROM subscriptions WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'not found' });
    console.log(`[DB] deleted subscription id ${id}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to delete subscription:', err.message);
    res.status(500).json({ error: 'Failed to delete subscription' });
  }
});

// Database smoke-test endpoints for quick Neon connectivity checks
app.get('/api/db-test', async (req, res) => {
  try {
    await ensureDbTestTable();
    const result = await pool.query(
      'SELECT id, label, created_at FROM db_smoke_test ORDER BY id DESC LIMIT 25'
    );
    res.json({ success: true, rows: result.rows });
  } catch (err) {
    console.error('DB test list failed:', err.message);
    res.status(500).json({ success: false, error: 'DB test list failed', details: err.message });
  }
});

app.post('/api/db-test', async (req, res) => {
  const label = (req.body?.label || 'smoke-test').toString().trim();

  try {
    await ensureDbTestTable();
    const result = await pool.query(
      'INSERT INTO db_smoke_test (label) VALUES ($1) RETURNING id, label, created_at',
      [label]
    );
    res.status(201).json({ success: true, row: result.rows[0] });
  } catch (err) {
    console.error('DB test insert failed:', err.message);
    res.status(500).json({ success: false, error: 'DB test insert failed', details: err.message });
  }
});

app.delete('/api/db-test/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ success: false, error: 'Valid numeric id required' });
  }

  try {
    await ensureDbTestTable();
    const result = await pool.query('DELETE FROM db_smoke_test WHERE id = $1 RETURNING id', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Row not found' });
    }

    res.json({ success: true, deletedId: id });
  } catch (err) {
    console.error('DB test delete failed:', err.message);
    res.status(500).json({ success: false, error: 'DB test delete failed', details: err.message });
  }
});

// Read-only schema/debug endpoint for accounts table
app.get('/api/accounts-schema-info', async (req, res) => {
  try {
    const [columnsResult, countResult] = await Promise.all([
      pool.query(
        `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'accounts'
         ORDER BY ordinal_position`
      ),
      pool.query('SELECT COUNT(*)::int AS total_accounts FROM accounts')
    ]);

    res.json({
      success: true,
      table: 'accounts',
      totalAccounts: countResult.rows[0].total_accounts,
      columns: columnsResult.rows
    });
  } catch (err) {
    console.error('Failed to fetch accounts schema info:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch accounts schema info' });
  }
});

// AI response endpoint
app.post('/api/ask', async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: 'No question provided' });

  try {
    // Fetch subscriptions from database
    const dbResult = await pool.query('SELECT * FROM subscriptions');
    const subscriptions = dbResult.rows.map(normalizeSubscriptionRow);

    // Build subscription text for context
    const subscriptionText = subscriptions
      .map(sub => {
        const cycle = (sub.billingCycle ?? "Monthly").toLowerCase();
        const cycleCost = sub.amountPerCycle ?? 0;

        let monthlyCost = 0;

        switch (cycle) {
          case "yearly":
            monthlyCost = cycleCost / 12;
            break;
          case "bi-monthly":
            monthlyCost = cycleCost / 2;
            break;
          case "weekly":
            monthlyCost = cycleCost * 4;
            break;
          case "monthly":
          default:
            monthlyCost = cycleCost;
        }

        const nextBilling = sub.date ?? "unknown";
        const category = sub.subscriptionType ?? "Other";
        const trialStatus = sub.isTrial ? "Trial" : "Paid";
        const personalValue = typeof sub.personalValue === 'number'
          ? ` User personal value rating ${sub.personalValue} out of 10.`
          : "";

        return `${sub.name} is a ${category} subscription, status ${trialStatus}. It costs $${cycleCost} per ${cycle} cycle (about $${monthlyCost}/month). Next billing date ${nextBilling}. Personal value: ${personalValue}`;
      })
      .join(" ");

    const response = await openai.chat.completions.create({
      model: "o3-mini",
      messages: [
        {
          role: "system",
          content: "You are a friendly, casual AI that chats like a helpful subscription financial advisor. Be chill and keep the tone light. Keep responses under 3 sentances. Always base recommendations and advice on subscription cost, usage, and emotional value, and compare similar services only. If it is not in the data, give general advice.".trim()
        },
        {
          role: "user",
          content: `Subscription data: ${subscriptionText}, answer questions using this data when possible, give month names in words and days and year in numbers. \nUser question: ${question}`
        }
      ]
    });

    res.json({ answer: response.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get AI response' });
  }
});




//const emailsPath = path.join(__dirname, 'data', 'emails.json');
//const emailsSentPath = path.join(__dirname, 'data', 'emailsSent.json');

// ensure emails.json exists
if (!fs.existsSync(emailsPath)) {
  fs.writeFileSync(emailsPath, JSON.stringify([], null, 2));
}

app.post('/subscribe', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

    // Special reset keyword
  if (email.toLowerCase() === 'resetemails') {
    console.log('Resetting emails.json to empty array');
    fs.writeFileSync(emailsPath, JSON.stringify([], null, 2), 'utf-8');
    return res.json({ success: true, message: 'emails.json has been reset' });
  }

  if (email.toLowerCase() === 'resetsent') {
  fs.writeFileSync(emailsSentPath, JSON.stringify([], null, 2), 'utf-8');
  return res.json({ success: true, message: 'emailsSent.json reset' });
  }

  let emails = [];
  try {
    emails = JSON.parse(fs.readFileSync(emailsPath, 'utf-8'));
  } catch (err) {
    emails = [];
  }

  if (!emails.includes(email)) {
    emails.push(email);
    fs.writeFileSync(emailsPath, JSON.stringify(emails, null, 2));
  }

  res.json({ success: true });

});

// Run every hour (1000 ms * 60 sec * 60 min)
setInterval(() => {
  sendEmailReminders(pool)
    .then(() => console.log("Email check done"))
    .catch(err => console.error("Email check failed:", err));
}, 10000); // 10 sec




async function startServer() {
  try {
    await ensureSubscriptionsTable();
    await ensureAccountsTable();
    console.log('Subscriptions table is ready');
    console.log('Accounts table is ready');

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  } catch (err) {
    console.error('Failed to initialize server:', {
      code: err.code,
      message: err.message,
      detail: err.detail,
      constraint: err.constraint
    });
    process.exit(1);
  }
}

startServer();