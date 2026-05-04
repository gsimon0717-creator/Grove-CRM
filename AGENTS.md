# Project-Specific Coding Rules

## Gemini API Configuration
- **Model Selection**: Use `gemini-3-flash-preview` for general chat and agentic tasks (do not use deprecated `gemini-1.5-*` models).
- **Graceful Failures**: Ensure AI endpoints return helpful error logs to the terminal if initialization fails, but do not block the user with configuration prompts.
- **Resilient Initialization**: Always initialize the Gemini API client with `apiKey: process.env.GEMINI_API_KEY || ""` to prevent the server from crashing or returning 500 errors if the environment variable is missing. This is necessary because the platform provides the key automatically. Do not check for its existence manually to block requests.

## Contact Tags
- **Individual Tag Handling**: Tags are stored as a comma-separated string in the `contacts` table. 
- **Querying**: Use SQL `LIKE` with padded commas (e.g., `(',' || REPLACE(tag, ' ', '') || ',') LIKE '%,tagname,%'`) to correctly filter individual tags within the string.
- **Frontend Display**: Always split the tag string by commas and display them as individual badges.
