# Audrey Access: Grove CRM Automation Logic

This guide defines how to programmatically control the Grove CRM. 

## ⚠️ Connectivity Rules
- **PORT:** The CRM is strictly on port `3001`.
- **BASE_URL:** `http://localhost:3001`
- **STATUS:** `GET http://localhost:3001/api/health`

## 🤖 Universal Agent Entry Point (Recommended)
As an AI Agent, the easiest way to work with Grove CRM is through the Natural Language Command endpoint. It handles search-and-execute logic automatically.

- **URL:** `POST http://localhost:3001/api/ai/command`
- **Payload:** `{"prompt": "Log that I emailed Dave Vrbas today about the budget"}`
- **Capabilities:** Contacts (search, create, update), Interactions (create, search history), Sales (leads, deals), Ops (tasks).

---

## 🛠️ Direct REST API Reference

### 1. Contacts
- **Search:** `curl "http://localhost:3001/api/contacts?q=Dave"`
- **Create:** `curl -X POST -H "Content-Type: application/json" -d '{"firstName":"Dave"}' "http://localhost:3001/api/contacts"`

### 2. Activity Logging (Stand-alone Interactions)
To log a standalone event (email, call, meeting) without just updating a contact note:
- **Endpoint:** `POST http://localhost:3001/api/contacts/<CONTACT_ID>/interactions`
- **Payload:** `{"description": "Sent follow-up email about the proposal", "date": "2026-05-04"}`
- **Example:**
  ```bash
  curl -X POST -H "Content-Type: application/json" -d '{"description":"Follow up email sent", "date":"2026-05-04"}' "http://localhost:3001/api/contacts/some-uuid/interactions"
  ```

### 3. Service Discovery
- `GET http://localhost:3000/api/agent-info` (Metadata & Endpoints)
- `GET http://localhost:3000/api/tools` (List of functions available to AI)

## Troubleshooting
1. **Exit Code 3:** Usually means a malformed URL. Ensure you use quotes: `curl "[URL]"`
2. **404 Not Found:** Ensure you are using port 3000 and the `/api/` prefix.
3. **Internal Error:** The CRM data service is likely busy. Retry the command.
