# Project-Specific Coding Rules

## Gemini API Configuration
- **Model Selection**: Use `gemini-1.5-flash` for general chat and agentic tasks (optimized for speed and standard platform availability).
- **Graceful Failures**: Ensure AI endpoints return helpful error logs to the terminal if initialization fails, but do not block the user with configuration prompts.

## Contact Tags
- **Individual Tag Handling**: Tags are stored as a comma-separated string in the `contacts` table. 
- **Querying**: Use SQL `LIKE` with padded commas (e.g., `(',' || REPLACE(tag, ' ', '') || ',') LIKE '%,tagname,%'`) to correctly filter individual tags within the string.
- **Frontend Display**: Always split the tag string by commas and display them as individual badges.
