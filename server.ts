import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes for Agent Access
  // In a real app, we'd use Firebase Admin SDK here for full access
  // For this demo, we'll provide endpoints that could be used by an agent
  
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "Grove CRM API" });
  });

  // Example API endpoints for the agent
  // Note: These would typically require an API key or Admin token
  app.get("/api/v1/leads", (req, res) => {
    // Agent would call this to get leads
    res.json({ message: "Agent API: Leads endpoint. Use Firebase Client SDK for real-time data or implement Admin SDK here." });
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
