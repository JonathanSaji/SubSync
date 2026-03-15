const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

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

// Data file for persistence
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'subscriptions.json');

//console.log("USER1_NAME:", process.env.USER1_NAME);
//console.log("USER1_PASS:", process.env.USER1_PASS);

const VALID_USERS = {
  [process.env.USER1_NAME]: process.env.USER1_PASS,
  [process.env.USER2_NAME]: process.env.USER2_PASS
};

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

// Load subscriptions (2D array) from file on startup
let subscriptions = [];
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    subscriptions = parsed.subscriptions || [];

    if (!Array.isArray(subscriptions)) subscriptions = [];
  } else {
    fs.writeFileSync(DATA_FILE, JSON.stringify(subscriptions, null, 2));
  }
} catch (err) {
  console.error('Failed to load subscriptions:', err);
  subscriptions = [];
}

function persist() {
  try {
    fs.writeFile(DATA_FILE, JSON.stringify(subscriptions, null, 2), (err) => {
      if (err) console.error('Failed to save subscriptions:', err);
    });
  } catch (err) {
    console.error('Persist error:', err);
  }
}

// Get all subscriptions
app.get('/api/subscriptions', (req, res) => {
  res.json(subscriptions);
});

// Add a subscription (saves the full object)
app.post('/api/subscriptions', (req, res) => {
  const sub = req.body;
  if (!sub.name) return res.status(400).json({ error: 'name required' });
  subscriptions.push(sub);
  persist();
  res.status(201).json(sub);
});

// Delete a subscription by id
app.delete('/api/subscriptions/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const before = subscriptions.length;
  subscriptions = subscriptions.filter(s => s.id !== id);
  if (subscriptions.length === before) return res.status(404).json({ error: 'not found' });
  persist();

  res.json({ ok: true });
});

// AI response endpoint
app.post('/api/ask', async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: 'No question provided' });

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
    const trialEnd = sub.trialEndDate ? ` Trial ends ${sub.trialEndDate}.` : "";
    const personalValue = typeof sub.personalValue === 'number'
      ? ` User personal value rating ${sub.personalValue} out of 10.`
      : "";

    return `${sub.name} is a ${category} subscription, status ${trialStatus}. It costs $${cycleCost} per ${cycle} cycle (about $${monthlyCost}/month). Next billing date ${nextBilling}.${trialEnd}${personalValue}`;
  })
  .join(" ");

  try {
    const response = await openai.chat.completions.create({
      model: "o3-mini",
      messages: [
        {
          role: "system",
          // content: `You are a professional financial assistant. Do not greet or ask questions. Give clear advice under 3 sentences. Base recommendations on subscription cost, usage, and emotional value, and compare similar services only. If it is not in the data, give general advice. `.trim()
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));