import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
// This requires FIREBASE_SERVICE_ACCOUNT in environment variables or a key file
const serviceAccountPath = path.join(process.cwd(), "grove/backend/serviceAccountKey.json");

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const serviceAccount = JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT.startsWith('{') 
        ? process.env.FIREBASE_SERVICE_ACCOUNT 
        : Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString()
    );
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase Admin initialized successfully from environment variable.");
  } catch (error) {
    console.error("Failed to initialize Firebase Admin from environment variable:", error);
  }
} else if (fs.existsSync(serviceAccountPath)) {
  try {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase Admin initialized successfully from serviceAccountKey.json.");
  } catch (error) {
    console.error("Failed to initialize Firebase Admin from serviceAccountKey.json:", error);
  }
} else {
  console.warn("Firebase Admin NOT initialized. Please set FIREBASE_SERVICE_ACCOUNT or provide grove/backend/serviceAccountKey.json");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Middleware to check API Key
  const authenticateAgent = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const apiKey = req.headers['x-api-key'];
    const validKey = process.env.GROVE_API_KEY;

    if (!validKey) {
      return res.status(500).json({ error: "API access not configured. Set GROVE_API_KEY in secrets." });
    }

    if (apiKey !== validKey) {
      return res.status(401).json({ error: "Invalid API Key" });
    }
    next();
  };

  // API Routes for Agent Access
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "Grove CRM API" });
  });

  // Get all leads
  app.get("/api/v1/leads", authenticateAgent, async (req, res) => {
    try {
      const snapshot = await admin.firestore().collection('leads').get();
      const leads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(leads);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get all contacts
  app.get("/api/v1/contacts", authenticateAgent, async (req, res) => {
    try {
      const snapshot = await admin.firestore().collection('contacts').get();
      const contacts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(contacts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create a new lead
  app.post("/api/v1/leads", authenticateAgent, async (req, res) => {
    try {
      const leadData = req.body;
      const docRef = await admin.firestore().collection('leads').add({
        ...leadData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      res.status(201).json({ id: docRef.id, message: "Lead created successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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
    console.log(`Grove CRM Server running on http://localhost:${PORT}`);
  });
}

startServer();
