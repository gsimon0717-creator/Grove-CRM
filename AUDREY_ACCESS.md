# Audrey Access: Grove CRM Automation Logic

This guide defines how to programmatically control the Grove CRM. 

## ⚠️ Connectivity Rules
- **PORT:** Defaults to `3000` (Optimized for AI Studio Preview).
- **LOCAL OVERRIDE:** Run with `PORT=3001 npm run dev` to use a different port locally.
- **STATUS:** `GET [BASE_URL]/api/health`

## 🤖 Universal Agent Entry Point (Highly Recommended)
If you are an AI agent, the most reliable way to interact with the CRM is via the Natural Language Command endpoint. It understands high-level instructions and manages IDs/Searching for you.

- **URL:** `POST [BASE_URL]/api/ai/command`
- **Payload:** `{"prompt": "Log that I had a meeting with the client today about the project kickoff"}`
- **Note:** Replace `[BASE_URL]` with the live app URL or your local address (e.g., `http://localhost:3000`).

---

## 🛠️ Direct REST API Reference

### 1. Contacts (Finding People)
- **Search:** `curl "[BASE_URL]/api/contacts?q=John%20Smith"`
  - *Note: Spaces MUST be percent-encoded as %20 in URLs.*
- **Create:** `curl -X POST -H "Content-Type: application/json" -d '{"firstName":"John"}' "[BASE_URL]/api/contacts"`

### 2. Activity Logging (Crucial)
To log emails, calls, or meetings, use the dedicated Interaction endpoint. **Do not just add a note to the contact record.**
- **Log new Interaction:**
  ```bash
  curl -X POST -H "Content-Type: application/json" -d '{"description":"Emailed regarding budget proposal", "date":"2026-05-04"}' "[BASE_URL]/api/contacts/<CONTACT_ID>/interactions"
  ```
  - *Replace `<CONTACT_ID>` with the actual ID from a contact search.*

### 3. Service & Tool Discovery
- `GET [BASE_URL]/api/agent-info` (Metadata & Live Ports)
- `GET [BASE_URL]/api/tools` (Functional tool list for AI)

## Troubleshooting
1. **Exit Code 3 (URL Malformed):** Use double quotes around the URL. Encode spaces in the search query (e.g., `q=Search%20Term`).
2. **Connection Refused:** Ensure the server is listening on the port you are hitting. Check `/api/health`.
3. **Internal Error:** If the data service is busy, simply wait 5 seconds and retry.
