# Project-Specific Coding Rules

## Gemini API Configuration
- **Resilient Initialization**: Always initialize the Gemini API client with `apiKey: process.env.GEMINI_API_KEY || ""` to prevent the server from crashing if the environment variable is missing.
- **Model Selection**: Prefer `gemini-1.5-flash` for general chat and agentic tasks unless a specific preview model is required.
- **Graceful Failures**: Ensure AI endpoints return helpful error logs to the terminal rather than just throwing 500 errors without context when keys are missing.

## Contact Tags
- **Individual Tag Handling**: Tags are stored as a comma-separated string in the `contacts` table. 
- **Querying**: Use SQL `LIKE` with padded commas (e.g., `(',' || REPLACE(tag, ' ', '') || ',') LIKE '%,tagname,%'`) to correctly filter individual tags within the string.
- **Frontend Display**: Always split the tag string by commas and display them as individual badges.
