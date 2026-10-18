# Dark Addon licensing starter

This is a development starter, not a finished production licensing system and not a modified Minecraft JAR.

## What it currently provides
- Express API server
- Ed25519-signed license tokens
- Basic license creation/activation/verification endpoints
- Local JSON storage for development only

## Important limitations
- The Minecraft JAR is NOT integrated with this server yet.
- No Discord bot is included yet.
- Local JSON storage is not suitable for production hosting; use persistent database storage before selling access.
- Do not deploy this for paying customers until authentication, rate limiting, database persistence, and client-side verification have been implemented and tested.

## Local setup
1. Install Node.js 20 or newer.
2. Extract this ZIP.
3. Open a terminal in this folder.
4. Run `npm install`.
5. Run `npm start`.

The server generates signing keys on first start. Keep `private-key.pem` secret and never upload it to GitHub.
