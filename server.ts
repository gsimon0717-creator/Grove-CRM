import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize SQLite Database
const dbPath = path.join(process.cwd(), "grove-crm.db");
const db = new Database(dbPath);

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    firstName TEXT,
    lastName TEXT,
    email1 TEXT,
    email2 TEXT,
    phone1 TEXT,
    phone2 TEXT,
    companyName TEXT,
    jobDescription TEXT,
    tag TEXT,
    otherInfo TEXT,
    createdAt TEXT
  );

  CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT,
    phone TEXT,
    status TEXT,
    value REAL,
    source TEXT,
    createdAt TEXT
  );

  CREATE TABLE IF NOT EXISTS deals (
    id TEXT PRIMARY KEY,
    name TEXT,
    value REAL,
    stage TEXT,
    expectedCloseDate TEXT,
    createdAt TEXT
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT,
    deadline TEXT,
    status TEXT,
    priority TEXT,
    createdAt TEXT
  );

  CREATE TABLE IF NOT EXISTS interactions (
    id TEXT PRIMARY KEY,
    contactId TEXT,
    date TEXT,
    description TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", mode: "local-sqlite" });
  });

  // --- CONTACTS ---
  app.get("/api/contacts", (req, res) => {
    const { q, sortBy, order, tag } = req.query;
    let queryStr = "SELECT * FROM contacts WHERE 1=1";
    const params: any[] = [];

    if (q) {
      queryStr += " AND (firstName LIKE ? OR lastName LIKE ? OR email1 LIKE ? OR email2 LIKE ? OR tag LIKE ? OR companyName LIKE ?)";
      const searchTerm = `%${q}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (tag) {
      queryStr += " AND tag = ?";
      params.push(tag);
    }

    const allowedSortColumns = ['firstName', 'lastName', 'email1', 'companyName', 'tag', 'createdAt'];
    const sortCol = allowedSortColumns.includes(sortBy as string) ? sortBy : 'createdAt';
    const sortDir = order === 'asc' ? 'ASC' : 'DESC';
    
    queryStr += ` ORDER BY ${sortCol} ${sortDir}`;

    const rows = db.prepare(queryStr).all(...params);
    res.json(rows);
  });

  app.get("/api/contacts/:id", (req, res) => {
    const row = db.prepare("SELECT * FROM contacts WHERE id = ?").get(req.params.id);
    if (row) {
      res.json(row);
    } else {
      res.status(404).json({ error: "Contact not found" });
    }
  });

  app.get("/api/contacts/:id/interactions", (req, res) => {
    const rows = db.prepare("SELECT * FROM interactions WHERE contactId = ? ORDER BY date DESC").all(req.params.id);
    res.json(rows);
  });

  app.post("/api/contacts/:id/interactions", (req, res) => {
    const { date, description } = req.body;
    const id = Math.random().toString(36).substring(2, 15);
    db.prepare("INSERT INTO interactions (id, contactId, date, description) VALUES (?, ?, ?, ?)").run(id, req.params.id, date, description);
    res.json({ id, contactId: req.params.id, date, description });
  });

  app.get("/api/tags", (req, res) => {
    const rows = db.prepare("SELECT DISTINCT tag FROM contacts WHERE tag IS NOT NULL AND tag != ''").all();
    res.json(rows.map((r: any) => r.tag));
  });

  app.post("/api/contacts", (req, res) => {
    const contact = req.body;
    const id = contact.id || Math.random().toString(36).substring(2, 15);
    const createdAt = contact.createdAt || new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO contacts (id, firstName, lastName, email1, email2, phone1, phone2, companyName, jobDescription, tag, otherInfo, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id, 
      contact.firstName || '', 
      contact.lastName || '', 
      contact.email1 || '', 
      contact.email2 || '', 
      contact.phone1 || '', 
      contact.phone2 || '', 
      contact.companyName || '', 
      contact.jobDescription || '', 
      contact.tag || '', 
      contact.otherInfo || '',
      createdAt
    );
    res.json({ id, ...contact, createdAt });
  });

  app.put("/api/contacts/:id", (req, res) => {
    const { id } = req.params;
    const contact = req.body;
    const stmt = db.prepare(`
      UPDATE contacts SET 
        firstName = ?, lastName = ?, email1 = ?, email2 = ?, 
        phone1 = ?, phone2 = ?, companyName = ?, jobDescription = ?, 
        tag = ?, otherInfo = ?
      WHERE id = ?
    `);
    stmt.run(
      contact.firstName || '', 
      contact.lastName || '', 
      contact.email1 || '', 
      contact.email2 || '', 
      contact.phone1 || '', 
      contact.phone2 || '', 
      contact.companyName || '', 
      contact.jobDescription || '', 
      contact.tag || '', 
      contact.otherInfo || '',
      id
    );
    res.json({ id, ...contact });
  });

  app.delete("/api/contacts/:id", (req, res) => {
    db.prepare("DELETE FROM contacts WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // --- LEADS ---
  app.get("/api/leads", (req, res) => {
    const rows = db.prepare("SELECT * FROM leads ORDER BY createdAt DESC").all();
    res.json(rows);
  });

  app.post("/api/leads", (req, res) => {
    const lead = req.body;
    const id = lead.id || Math.random().toString(36).substring(2, 15);
    const createdAt = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO leads (id, name, email, phone, status, value, source, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, lead.name, lead.email, lead.phone, lead.status, lead.value, lead.source, createdAt);
    res.json({ id, ...lead, createdAt });
  });

  // --- DEALS ---
  app.get("/api/deals", (req, res) => {
    const rows = db.prepare("SELECT * FROM deals ORDER BY createdAt DESC").all();
    res.json(rows);
  });

  app.post("/api/deals", (req, res) => {
    const deal = req.body;
    const id = deal.id || Math.random().toString(36).substring(2, 15);
    const createdAt = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO deals (id, name, value, stage, expectedCloseDate, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, deal.name, deal.value, deal.stage, deal.expectedCloseDate, createdAt);
    res.json({ id, ...deal, createdAt });
  });

  // --- TASKS ---
  app.get("/api/tasks", (req, res) => {
    const rows = db.prepare("SELECT * FROM tasks ORDER BY createdAt DESC").all();
    res.json(rows);
  });

  app.post("/api/tasks", (req, res) => {
    const task = req.body;
    const id = task.id || Math.random().toString(36).substring(2, 15);
    const createdAt = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO tasks (id, title, deadline, status, priority, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, task.title, task.deadline, task.status, task.priority, createdAt);
    res.json({ id, ...task, createdAt });
  });

  // --- AI ASSISTANT ---
  app.post("/api/chat", async (req, res) => {
    const { messages, systemInstruction, tools } = req.body;
    
    try {
      const { GoogleGenAI } = await import("@google/genai");
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API key not configured on server." });
      }

      const genAI = new GoogleGenAI({ apiKey });
      const model = genAI.getGenerativeModel({ 
        model: "gemini-3-flash-preview",
        systemInstruction,
        tools: tools ? [{ functionDeclarations: tools }] : undefined,
      });

      // Prepare history (excluding the last message which we'll send)
      const history = messages.slice(0, -1).map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));

      const chat = model.startChat({ history });
      const lastMessage = messages[messages.length - 1].content;
      
      const result = await chat.sendMessage(lastMessage);
      const response = result.response;
      
      // Return function calls or text
      const functionCalls = response.functionCalls();
      if (functionCalls) {
        return res.json({ functionCalls });
      }

      const text = response.text();
      res.json({ text });
    } catch (error: any) {
      console.error("Gemini Error:", error);
      res.status(500).json({ error: error.message || "Failed to communicate with AI" });
    }
  });

  // Handle Tool Results
  app.post("/api/chat/tool-results", async (req, res) => {
    const { messages, toolResults, systemInstruction, tools } = req.body;
    
    try {
      const { GoogleGenAI } = await import("@google/genai");
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API key not configured on server." });
      }

      const genAI = new GoogleGenAI({ apiKey });
      const model = genAI.getGenerativeModel({ 
        model: "gemini-3-flash-preview",
        systemInstruction,
        tools: tools ? [{ functionDeclarations: tools }] : undefined,
      });

      const history = messages.map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));

      const chat = model.startChat({ history });
      
      // Send tool results back to the model
      const result = await chat.sendMessage(toolResults.map((tr: any) => ({
        functionResponse: tr.functionResponse
      })));
      
      const response = result.response;
      const functionCalls = response.functionCalls();
      
      if (functionCalls) {
        return res.json({ functionCalls });
      }

      const text = response.text();
      res.json({ text });
    } catch (error: any) {
      console.error("Gemini Tool Error:", error);
      res.status(500).json({ error: error.message || "Failed to process tool results" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Grove CRM Server running on http://localhost:${PORT} in LOCAL mode`);
  });
}

startServer();
