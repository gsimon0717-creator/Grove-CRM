# Audrey Access: Grove CRM API Documentation

This document defines the capabilities and endpoints for the Grove CRM automation agent.

## Core API Endpoints
- **Base URL:** `http://localhost:3000`
- **Health Check:** `GET /api/health`
- **Agent Info:** `GET /api/agent-info`

## Automation Capabilities (Tools)

### 1. Contacts
- **Search Contacts:** `search_contacts(query: string, tag?: string)`
- **Create Contact:** `create_contact(firstName: string, lastName?: string, email1?: string, tag?: string)`
- **Update Contact:** `update_contact(id: string, firstName?: string, lastName?: string, email1?: string, tag?: string)`

### 2. Interactions (Crucial)
- **Log Interaction:** `create_interaction(contactId: string, description: string, date?: string)`
  - *Note: Standalone event logging. Use this to record calls, emails, and meetings.*
- **Get History:** `get_interactions(contactId: string)`
- **Global Search:** `search_interactions_globally(query: string)`

### 3. Sales & Pipeline
- **Create Lead:** `create_lead(name: string, email?: string, value?: number)`
- **Create Deal:** `create_deal(name: string, value: number, stage?: string)`

### 4. Operations
- **Create Task:** `create_task(title: string, deadline?: string, priority?: string)`

## Guidelines for Audrey
1. **Always Search First:** Before performing an action on a contact (logging interaction, updating), use `search_contacts` to find the correct `id`.
2. **Be Concise:** Confirm actions clearly but briefly.
3. **Internal Errors:** If an API call fails, inform the user about a "technical difficulty with the CRM backend" and offer to retry. Do not mention API keys or environment variables.
