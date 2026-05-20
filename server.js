const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { sendEmailReminders } = require('./emailReminders');

require("dotenv").config({ quiet: true });
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const app = express();  
app.use(cors());
app.use(express.json());


// Serve static frontend files from the project root
app.use(express.static(path.join(__dirname)));

// Root route: send the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'HTMLtest.html'));
});

// Event logging utility
function logEvent(eventType, eventName, details = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    eventType,
    eventName,
    details
  };
  
  const logLine = `${timestamp} | [${eventType}] ${eventName} | ${JSON.stringify(details)}\n`;
  
  try {
    fs.appendFileSync(EVENTS_LOG_PATH, logLine, 'utf-8');
  } catch (err) {
    console.error('Failed to write to events log:', err.message);
  }
  
  return logEntry;
}

// Endpoint to receive logged events from frontend
app.post('/api/log-event', (req, res) => {
  const { eventType, eventName, details } = req.body;
  
  if (!eventType || !eventName) {
    return res.status(400).json({ error: 'eventType and eventName required' });
  }
  
  logEvent(eventType, eventName, details);
  res.json({ success: true });
});

// Endpoint to view recent logs
app.get('/api/logs', (req, res) => {
  try {
    if (!fs.existsSync(EVENTS_LOG_PATH)) {
      return res.json({ success: true, logs: [] });
    }
    
    const content = fs.readFileSync(EVENTS_LOG_PATH, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim()).slice(-100); // Last 100 lines
    
    res.json({ success: true, logCount: lines.length, logs: lines });
  } catch (err) {
    console.error('Failed to read events log:', err.message);
    res.status(500).json({ success: false, error: 'Failed to read logs' });
  }
});

// Data file for email subscriptions only
const DATA_DIR = path.join(__dirname, 'data');
const LOGS_DIR = path.join(__dirname, 'logs');

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

const EVENTS_LOG_PATH = path.join(LOGS_DIR, 'events.log');

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

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, originalHash] = storedHash.split(':');
  const attemptedHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(originalHash, 'hex'), Buffer.from(attemptedHash, 'hex'));
}

function redactSensitiveBody(body) {
  if (!body || typeof body !== 'object') return body;
  const redacted = { ...body };
  const sensitiveKeys = ['password', 'signupPassword', 'loginPassword'];
  for (const key of sensitiveKeys) {
    if (Object.prototype.hasOwnProperty.call(redacted, key)) {
      redacted[key] = '[REDACTED]';
    }
  }
  return redacted;
}

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    console.log(`[API] ${req.method} ${req.path}`, req.method === 'GET' ? '' : redactSensitiveBody(req.body) || '');
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
      user_id BIGINT,
      name TEXT NOT NULL,
      amount NUMERIC(10, 2),
      date TEXT,
      "subscriptionType" TEXT,
      color TEXT,
      "isTrial" BOOLEAN DEFAULT FALSE,
      "billingCycle" TEXT DEFAULT 'Monthly',
      "amountPerCycle" NUMERIC(10, 2),
      "personalValue" SMALLINT,
      last_reminder_sent_date TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE
    )
  `);
  
  try {
    await pool.query(`
      ALTER TABLE subscriptions
      ADD COLUMN user_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE
    `);
  } catch (err) {
    if (err.code === '42701') {
      console.log('[DB] user_id column already exists on subscriptions table');
    } else {
      throw err;
    }
  }

  try {
    await pool.query(`
      ALTER TABLE subscriptions
      ADD COLUMN last_reminder_sent_date TEXT
    `);
  } catch (err) {
    if (err.code === '42701') {
      console.log('[DB] last_reminder_sent_date column already exists on subscriptions table');
    } else {
      throw err;
    }
  }
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

  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS accounts_username_lower_uq ON accounts (LOWER(username))`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS accounts_email_lower_uq ON accounts (LOWER(email))`);

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

// Login endpoint (username or email + password)
app.post('/api/login', async (req, res) => {
  const identifier = (req.body?.identifier ?? req.body?.username ?? '').trim();
  const password = req.body?.password ?? '';

  if (!identifier || !password) {
    return res.status(400).json({ success: false, error: 'identifier and password required' });
  }

  try {
    const accountResult = await pool.query(
      `SELECT id, username, email, password_hash, role, is_active
       FROM accounts
       WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)
       LIMIT 1`,
      [identifier]
    );

    if (accountResult.rowCount === 0) {
      return res.json({ success: false });
    }

    const account = accountResult.rows[0];
    if (!account.is_active) {
      return res.status(403).json({ success: false, error: 'Account is disabled' });
    }

    const validPassword = verifyPassword(password, account.password_hash);
    if (!validPassword) {
      return res.json({ success: false });
    }

    await pool.query(
      'UPDATE accounts SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1',
      [account.id]
    );

    return res.json({
      success: true,
      user: account.username,
      userId: Number(account.id),
      email: account.email,
      role: account.role
    });
  } catch (err) {
    console.error('Login failed:', err.message);
    return res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// Create account endpoint
app.post('/api/signup', async (req, res) => {
  const username = (req.body?.username ?? '').trim();
  const email = (req.body?.email ?? '').trim().toLowerCase();
  const password = req.body?.password ?? '';

  if (!username || !email || !password) {
    return res.status(400).json({ success: false, error: 'username, email, and password are required' });
  }

  if (username.length < 3) {
    return res.status(400).json({ success: false, error: 'username must be at least 3 characters' });
  }

  if (password.length < 1) {
    return res.status(400).json({ success: false, error: 'password cannot be empty' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, error: 'invalid email format' });
  }

  try {
    const passwordHash = hashPassword(password);

    const result = await pool.query(
      `INSERT INTO accounts (username, email, password_hash, display_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, email, display_name, role, is_active, email_verified, created_at, updated_at`,
      [username, email, passwordHash, username]
    );

    return res.status(201).json({ success: true, account: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, error: 'username or email already exists' });
    }

    console.error('Signup failed:', err.message);
    return res.status(500).json({ success: false, error: 'Signup failed' });
  }
});

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Get all subscriptions for current user from database
app.get('/api/subscriptions', async (req, res) => {
  const userId = req.body?.userId || req.query?.userId;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    const rows = result.rows.map(normalizeSubscriptionRow);
    console.log(`[DB] fetched ${rows.length} subscriptions for user ${userId}`);
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
  if (!sub.userId) return res.status(400).json({ error: 'userId required' });

  const name = capitalizeWords(sub.name);
  const amount = sub.amount ?? null;
  const date = sub.date ?? null;
  const subscriptionType = sub.subscriptionType ?? null;
  const color = sub.color ?? null;
  const isTrial = sub.isTrial ?? false;
  const billingCycle = sub.billingCycle ?? 'Monthly';
  const amountPerCycle = sub.amountPerCycle ?? null;
  const personalValue = sub.personalValue ?? null;
  const userId = sub.userId;

  try {
    const result = await pool.query(
      `INSERT INTO subscriptions (id, user_id, name, amount, date, "subscriptionType", color, "isTrial", "billingCycle", "amountPerCycle", "personalValue")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [sub.id, userId, name, amount, date, subscriptionType, color, isTrial, billingCycle, amountPerCycle, personalValue]
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

// Delete a subscription by id (verify user ownership)
app.delete('/api/subscriptions/:id', async (req, res) => {
  const id = req.params.id;
  const userId = req.body?.userId || req.query?.userId;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM subscriptions WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'not found or unauthorized' });
    console.log(`[DB] deleted subscription id ${id} for user ${userId}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to delete subscription:', err.message);
    res.status(500).json({ error: 'Failed to delete subscription' });
  }
});

// ==========================================
// ADMIN CONSOLE ROUTES
// ==========================================

// DELETE /api/admin/reset-users?username=someuser
// If username is provided, deletes only that user + their subscriptions.
// If no username, deletes ALL users and ALL subscriptions.
app.delete('/api/admin/reset-users', async (req, res) => {
  const { username } = req.query;
  try {
    if (username) {
      // Delete one user by username (case-insensitive)
      const userResult = await pool.query(
        'SELECT id FROM accounts WHERE LOWER(username) = LOWER($1)',
        [username]
      );
      if (userResult.rows.length === 0) {
        logEvent('ADMIN', 'reset-users (single)', { username, status: 'not_found' });
        return res.status(404).json({ success: false, error: `User "${username}" not found.` });
      }
      const userId = userResult.rows[0].id;
      await pool.query('DELETE FROM subscriptions WHERE user_id = $1', [userId]);
      await pool.query('DELETE FROM accounts WHERE id = $1', [userId]);
      logEvent('ADMIN', 'reset-users (single)', { username, userId, status: 'deleted' });
      return res.json({ success: true, message: `Deleted user "${username}" and their subscriptions.` });
    } else {
      // Delete all subscriptions then all accounts, then reset ID sequence to 0
      const subDel = await pool.query('DELETE FROM subscriptions RETURNING id');
      const accDel = await pool.query('DELETE FROM accounts RETURNING id');
      await pool.query(`ALTER SEQUENCE accounts_id_seq RESTART WITH 1`);
      logEvent('ADMIN', 'reset-users (all)', {
        status: 'deleted',
        subscriptionsRemoved: subDel.rowCount,
        accountsRemoved: accDel.rowCount
      });
      return res.json({
        success: true,
        message: `Deleted all ${accDel.rowCount} account(s) and ${subDel.rowCount} subscription(s).`
      });
    }
  } catch (err) {
    console.error('Admin reset-users error:', err);
    logEvent('ADMIN', 'reset-users', { status: 'error', error: err.message });
    return res.status(500).json({ success: false, error: 'Server error during reset.' });
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
  const { question, userId } = req.body;
  if (!question) return res.status(400).json({ error: 'No question provided' });
  if (!userId) return res.status(400).json({ error: 'userId required' });

  try {
    // Fetch subscriptions from database for this user
    const dbResult = await pool.query(
      'SELECT * FROM subscriptions WHERE user_id = $1',
      [userId]
    );
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

// Email reminder check every 10 seconds
setInterval(() => {
  sendEmailReminders(pool)
    .then(() => console.log("Email reminder check completed"))
    .catch(err => console.error("Email reminder check failed:", err));
}, 10000);

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