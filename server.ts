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
      queryStr += " AND (firstName LIKE ? OR lastName LIKE ? OR email1 LIKE ? OR email2 LIKE ? OR tag LIKE ?)";
      const searchTerm = `%${q}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
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
