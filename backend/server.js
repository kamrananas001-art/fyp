const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ─── Ticket Storage (JSON file) ───────────────────────────────────────────────
const TICKETS_FILE = path.join(__dirname, 'tickets.json');

function readTickets() {
  try {
    if (!fs.existsSync(TICKETS_FILE)) fs.writeFileSync(TICKETS_FILE, '[]');
    return JSON.parse(fs.readFileSync(TICKETS_FILE, 'utf8'));
  } catch { return []; }
}

function writeTickets(tickets) {
  fs.writeFileSync(TICKETS_FILE, JSON.stringify(tickets, null, 2));
}

// GET all tickets (admin)
app.get('/api/tickets', (req, res) => {
  const tickets = readTickets();
  // Sort newest first
  tickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(tickets);
});

// GET tickets for a specific user
app.get('/api/tickets/user/:userId', (req, res) => {
  const tickets = readTickets().filter(t => t.userId === req.params.userId);
  tickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(tickets);
});

// POST create ticket
app.post('/api/tickets', (req, res) => {
  const { userId, userEmail, title, description } = req.body;
  if (!userId || !title || !description) {
    return res.status(400).json({ error: 'userId, title, and description are required.' });
  }
  const tickets = readTickets();
  const newTicket = {
    id: Date.now().toString(),
    userId,
    userEmail: userEmail || 'Unknown',
    title,
    description,
    status: 'Open',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  tickets.push(newTicket);
  writeTickets(tickets);
  console.log(`[TICKET] Created: "${title}" by ${userEmail}`);
  res.status(201).json(newTicket);
});

// PUT update ticket status
app.put('/api/tickets/:id/status', (req, res) => {
  const { status } = req.body;
  const validStatuses = ['Open', 'In Progress', 'Resolved', 'Closed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status value.' });
  }
  const tickets = readTickets();
  const idx = tickets.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Ticket not found.' });
  tickets[idx].status = status;
  tickets[idx].updatedAt = new Date().toISOString();
  writeTickets(tickets);
  console.log(`[TICKET] Status updated: ${req.params.id} -> ${status}`);
  res.json(tickets[idx]);
});

// ─── AI Chat ──────────────────────────────────────────────────────────────────
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.openrouter || 'placeholder',
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:3000",
    "X-OpenRouter-Title": "Electric Store Assistant",
  },
});

const SYSTEM_PROMPT =
  'You are a specialized AI assistant for an Electric Store called "Nexus Electro" based in Pakistan. ' +
  'Your expertise includes home appliances (refrigerators, washing machines, microwaves), ' +
  'consumer electronics (smartphones, laptops, TVs), and electrical fittings. ' +
  'You should provide prices in Pakistani Rupees (PKR) and be aware of common brands available in Pakistan (like Haier, Dawlance, Pel, etc.). ' +
  'STRICT RULE: If a user asks you anything NOT related to electronics, appliances, or store services, ' +
  "you must politely say: 'I am here to help you with electronics and appliances in Pakistan. Please ask me about our products!' " +
  'Provide helpful, professional, and technical advice when asked about specific appliance features.';

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!process.env.openrouter) {
    return res.status(500).json({ reply: 'Error: Please set your OpenRouter API key in the .env file.' });
  }
  if (!message) return res.status(400).json({ error: 'Message is required' });

  try {
    const completion = await openai.chat.completions.create({
      model: "qwen/qwen-plus",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: message }
      ]
    });
    const reply = completion.choices[0]?.message?.content || 'No response from AI.';
    res.json({ reply });
  } catch (error) {
    console.error('OpenRouter Error:', error);
    res.status(500).json({
      reply: 'Sorry, I am having trouble connecting to my brain right now. Please try again later.'
    });
  }
});

app.get('/', (req, res) => res.send('Nexus Electro AI Backend Running ✅'));

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📋 Tickets stored at: ${TICKETS_FILE}`);
});

// Triggered restart to load updated .env variables
