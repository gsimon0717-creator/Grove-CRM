import "dotenv/config";
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
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // API Routes
  app.use((req, res, next) => {
    console.log(`[CRM-REQUEST] ${req.method} ${req.url}`);
    next();
  });

  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      mode: "local-sqlite",
      hasAiKey: !!process.env.GEMINI_API_KEY,
      timestamp: new Date().toISOString()
    });
  });

  app.get("/api/agent-info", (req, res) => {
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const host = req.get('host') || `localhost:${PORT}`;
    const dynamicBaseURL = `${protocol}://${host}`;

    res.json({
      name: "Grove CRM Agent API",
      baseURL: dynamicBaseURL,
      port: PORT,
      endpoints: {
        command: "/api/ai/command",
        contacts: "/api/contacts",
        interactions: "/api/contacts/:id/interactions",
        leads: "/api/leads",
        deals: "/api/deals",
        tasks: "/api/tasks",
        tools_discovery: "/api/tools"
      },
      instructions: "Prefer 'POST /api/ai/command' for all tasks. It handles search and execution logic. For direct REST, ensure URLs are quoted and spaces are percent-encoded."
    });
  });

  app.get("/api/tools", (req, res) => {
    res.json(CRM_TOOLS);
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
      // Handle comma-separated tags by checking if the tag exists within the string
      queryStr += " AND (',' || REPLACE(tag, ' ', '') || ',') LIKE ?";
      params.push(`%,${(tag as string).replace(/\s/g, '')},%`);
    }

    const allowedSortColumns = ['firstName', 'lastName', 'email1', 'companyName', 'tag', 'createdAt'];
    const sortCol = allowedSortColumns.includes(sortBy as string) ? sortBy : 'createdAt';
    const sortDir = order === 'asc' ? 'ASC' : 'DESC';
    
    queryStr += ` ORDER BY ${sortCol} ${sortDir}`;

    const rows = db.prepare(queryStr).all(...params);
    res.json(rows);
  });

  app.get("/api/interactions/search", (req, res) => {
    const { q } = req.query;
    if (!q) return res.json([]);
    const rows = db.prepare(`
      SELECT i.*, c.firstName, c.lastName 
      FROM interactions i
      JOIN contacts c ON i.contactId = c.id
      WHERE i.description LIKE ?
      ORDER BY i.date DESC
    `).all(`%${q}%`);
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
    const rows = db.prepare("SELECT tag FROM contacts WHERE tag IS NOT NULL AND tag != ''").all();
    const allTags = new Set<string>();
    rows.forEach((r: any) => {
      r.tag.split(',').forEach((t: string) => {
        const trimmed = t.trim();
        if (trimmed) allTags.add(trimmed);
      });
    });
    res.json(Array.from(allTags).sort());
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
        firstName = ?, lastName = ?, email1 = ?, 
        tag = ?, otherInfo = ?
      WHERE id = ?
    `);
    stmt.run(
      contact.firstName || '', 
      contact.lastName || '', 
      contact.email1 || '', 
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
  // --- AI ASSISTANT & AGENT API ---
  const CRM_TOOLS = [
    {
      name: "search_contacts",
      description: "Search for contacts by name, email, or tag.",
      parameters: {
        type: "OBJECT",
        properties: {
          query: { type: "STRING", description: "Search term" },
          tag: { type: "STRING", description: "Filter by tag" }
        },
        required: ["query"]
      }
    },
    {
      name: "create_contact",
      description: "Create a new contact in the CRM.",
      parameters: {
        type: "OBJECT",
        properties: {
          firstName: { type: "STRING" },
          lastName: { type: "STRING" },
          email1: { type: "STRING" },
          phone1: { type: "STRING" },
          companyName: { type: "STRING" },
          tag: { type: "STRING", description: "Comma-separated tags" },
          otherInfo: { type: "STRING" }
        },
        required: ["firstName"]
      }
    },
    {
      name: "update_contact",
      description: "Update an existing contact.",
      parameters: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING", description: "The contact ID" },
          firstName: { type: "STRING" },
          lastName: { type: "STRING" },
          email1: { type: "STRING" },
          tag: { type: "STRING" },
          otherInfo: { type: "STRING" }
        },
        required: ["id"]
      }
    },
    {
      name: "get_interactions",
      description: "Get interaction history for a contact.",
      parameters: {
        type: "OBJECT",
        properties: {
          contactId: { type: "STRING", description: "Contact ID" }
        },
        required: ["contactId"]
      }
    },
    {
      name: "search_interactions_globally",
      description: "Search all interaction logs across all contacts for specific keywords (e.g., 'budget', 'meeting').",
      parameters: {
        type: "OBJECT",
        properties: {
          query: { type: "STRING", description: "The keyword to search for in interaction summaries." }
        },
        required: ["query"]
      }
    },
    {
      name: "create_interaction",
      description: "Log a new interaction (summary, call, meeting).",
      parameters: {
        type: "OBJECT",
        properties: {
          contactId: { type: "STRING", description: "Contact ID" },
          date: { type: "STRING", description: "Date (YYYY-MM-DD)" },
          description: { type: "STRING", description: "Summary" }
        },
        required: ["contactId", "description"]
      }
    },
    {
      name: "create_lead",
      description: "Create a new lead.",
      parameters: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          email: { type: "STRING" },
          status: { type: "STRING", enum: ["new", "qualified", "unqualified", "closed"] },
          value: { type: "NUMBER" }
        },
        required: ["name"]
      }
    },
    {
      name: "create_deal",
      description: "Create a new deal.",
      parameters: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          value: { type: "NUMBER" },
          stage: { type: "STRING", enum: ["discovery", "proposal", "negotiation", "won", "lost"] },
          expectedCloseDate: { type: "STRING" }
        },
        required: ["name", "value"]
      }
    },
    {
      name: "create_task",
      description: "Create a new task.",
      parameters: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          deadline: { type: "STRING" },
          priority: { type: "STRING", enum: ["low", "medium", "high"] }
        },
        required: ["title"]
      }
    },
    {
      name: "get_leads",
      description: "List all leads in the CRM."
    },
    {
      name: "get_deals",
      description: "List all deals in the CRM."
    },
    {
      name: "get_tasks",
      description: "List all tasks in the CRM."
    }
  ];

  const executeServerTool = async (name: string, args: any) => {
    switch (name) {
      case 'get_leads':
        return db.prepare("SELECT * FROM leads ORDER BY createdAt DESC").all();
      case 'get_deals':
        return db.prepare("SELECT * FROM deals ORDER BY createdAt DESC").all();
      case 'get_tasks':
        return db.prepare("SELECT * FROM tasks ORDER BY createdAt DESC").all();
      case 'search_contacts':
        let q = "SELECT * FROM contacts WHERE (firstName LIKE ? OR lastName LIKE ? OR email1 LIKE ? OR email2 LIKE ? OR tag LIKE ? OR companyName LIKE ?)";
        const term = `%${args.query}%`;
        const params: any[] = [term, term, term, term, term, term];
        
        if (args.tag) {
          q += " AND (',' || REPLACE(tag, ' ', '') || ',') LIKE ?";
          params.push(`%,${args.tag.replace(/\s/g, '')},%`);
        }
        
        return db.prepare(q).all(...params);
      case 'create_contact': {
        const id = Math.random().toString(36).substring(2, 15);
        const createdAt = new Date().toISOString();
        db.prepare(`
          INSERT INTO contacts (id, firstName, lastName, email1, email2, phone1, phone2, companyName, jobDescription, tag, otherInfo, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, args.firstName || '', args.lastName || '', args.email1 || '', '', args.phone1 || '', '', args.companyName || '', '', args.tag || '', args.otherInfo || '', createdAt);
        return { success: true, id };
      }
      case 'update_contact': {
        const { id, ...updates } = args;
        const current = db.prepare("SELECT * FROM contacts WHERE id = ?").get(id) as any;
        if (!current) return { error: "Contact not found" };
        
        db.prepare(`
          UPDATE contacts SET 
            firstName = ?, lastName = ?, email1 = ?, tag = ?, otherInfo = ?
          WHERE id = ?
        `).run(
          updates.firstName ?? current.firstName,
          updates.lastName ?? current.lastName,
          updates.email1 ?? current.email1,
          updates.tag ?? current.tag,
          updates.otherInfo ?? current.otherInfo,
          id
        );
        return { success: true };
      }
      case 'get_interactions':
        return db.prepare("SELECT * FROM interactions WHERE contactId = ? ORDER BY date DESC").all(args.contactId);
      case 'search_interactions_globally':
        return db.prepare(`
          SELECT i.*, c.firstName, c.lastName 
          FROM interactions i
          JOIN contacts c ON i.contactId = c.id
          WHERE i.description LIKE ?
          ORDER BY i.date DESC
        `).all(`%${args.query}%`);
      case 'create_interaction':
        const id = Math.random().toString(36).substring(2, 15);
        const date = args.date || new Date().toISOString().split('T')[0];
        db.prepare("INSERT INTO interactions (id, contactId, date, description) VALUES (?, ?, ?, ?)").run(id, args.contactId, date, args.description);
        return { success: true, id };
      case 'create_lead': {
        const lid = Math.random().toString(36).substring(2, 15);
        db.prepare("INSERT INTO leads (id, name, email, status, value, createdAt) VALUES (?, ?, ?, ?, ?, ?)").run(lid, args.name, args.email || '', args.status || 'new', args.value || 0, new Date().toISOString());
        return { success: true, id: lid };
      }
      case 'create_deal': {
        const did = Math.random().toString(36).substring(2, 15);
        db.prepare("INSERT INTO deals (id, name, value, stage, expectedCloseDate, createdAt) VALUES (?, ?, ?, ?, ?, ?)").run(did, args.name, args.value, args.stage || 'discovery', args.expectedCloseDate || '', new Date().toISOString());
        return { success: true, id: did };
      }
      case 'create_task': {
        const tid = Math.random().toString(36).substring(2, 15);
        db.prepare("INSERT INTO tasks (id, title, deadline, status, priority, createdAt) VALUES (?, ?, ?, ?, ?, ?)").run(tid, args.title, args.deadline || '', 'pending', args.priority || 'medium', new Date().toISOString());
        return { success: true, id: tid };
      }
      default:
        return { error: "Unknown tool" };
    }
  };

  app.post("/api/ai/command", async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "No prompt provided" });

    try {
      const { GoogleGenAI } = await import("@google/genai");
      const apiKey = process.env.GEMINI_API_KEY || "";
      
      const ai = new GoogleGenAI({ apiKey });
      const systemInstruction = "You are a CRM agent API. Your goal is to execute tasks based on natural language commands. \n\n### CAPABILITIES:\n1. Manage Contacts (search, create, update)\n2. Manage Interactions (log new discussions, search history)\n3. Sales Pipeline (create leads, deals)\n4. Operations (create tasks)\n\n### BEHAVIOR:\n- If you need a contact ID, SEARCH for the person first.\n- If multiple people match, list them and stop to ask for clarification.\n- When logging interactions, confirm the date (default: today) and summary.\n- Be concise and actionable.\n- IF AN API ERROR OCCURS: Do not speculate about configuration or keys. Simply say \"I'm having trouble connecting to the CRM data service right now.\" and offer to try again later.";
      
      const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: CRM_TOOLS as any }]
        }
      });

      let response = await chat.sendMessage({ message: prompt });
      
      // Handle function calls loop (server-side)
      let currentFunctionCalls = response.functionCalls;
      while (currentFunctionCalls) {
        const toolResults = [];
        for (const call of currentFunctionCalls) {
          const result = await executeServerTool(call.name, call.args);
          toolResults.push({
            functionResponse: { name: call.name, response: { result } }
          });
        }
        
        response = await chat.sendMessage({
          message: toolResults.map(tr => ({ functionResponse: tr.functionResponse }))
        });
        currentFunctionCalls = response.functionCalls;
      }

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Agent API Error [CRM-AI]:", error);
      // provide a clean error to the agent to avoid leaking internals if not needed, 
      // but the agent needs to know it failed.
      const publicError = error.message?.includes("API_KEY") 
        ? "The CRM data service is currently unavailable. Please try again in a few minutes."
        : `CRM Service Difficulty: ${error.message}`;
      res.status(500).json({ error: publicError });
    }
  });

  app.post("/api/chat", async (req, res) => {
    const { messages, systemInstruction, tools } = req.body;
    
    try {
      const { GoogleGenAI } = await import("@google/genai");
      const apiKey = process.env.GEMINI_API_KEY;
      
      const ai = new GoogleGenAI({ apiKey: apiKey || "" });
      
      // Prepare history (excluding the last message which we'll send)
      const history = messages.slice(0, -1).map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));

      const chat = ai.chats.create({ 
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction,
          tools: tools ? [{ functionDeclarations: tools }] : undefined,
        },
        history
      });

      const lastMessage = messages[messages.length - 1].content;
      const result = await chat.sendMessage({ message: lastMessage });
      
      // Return function calls or text
      const functionCalls = result.functionCalls;
      if (functionCalls) {
        return res.json({ functionCalls });
      }

      const text = result.text;
      res.json({ text });
    } catch (error: any) {
      console.error("Gemini Error [ID: CRM-CHAT]:", error);
      res.status(500).json({ error: `[CRM-CHAT-ERROR] ${error.message || "Failed to communicate with AI"}` });
    }
  });

  // Handle Tool Results
  app.post("/api/chat/tool-results", async (req, res) => {
    const { messages, toolResults, systemInstruction, tools } = req.body;
    
    try {
      const { GoogleGenAI } = await import("@google/genai");
      const apiKey = process.env.GEMINI_API_KEY;
      
      const ai = new GoogleGenAI({ apiKey: apiKey || "" });
      
      const history = messages.map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));

      const chat = ai.chats.create({ 
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction,
          tools: tools ? [{ functionDeclarations: tools }] : undefined,
        },
        history
      });
      
      // Send tool results back to the model
      const result = await chat.sendMessage({
        message: toolResults.map((tr: any) => ({ functionResponse: tr.functionResponse }))
      });
      
      const functionCalls = result.functionCalls;
      
      if (functionCalls) {
        return res.json({ functionCalls });
      }

      const text = result.text;
      res.json({ text });
    } catch (error: any) {
      console.error("Gemini Tool Error [ID: CRM-TOOL]:", error);
      res.status(500).json({ error: `[CRM-TOOL-ERROR] ${error.message || "Failed to process tool results"}` });
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
    console.log(`Grove CRM Server primary listener on http://localhost:${PORT}`);
  });
}

startServer();
