# Amadeus Assist

A browser-based **fictional GDS training simulator**. Availability, fares, PNRs, record locators and ticket numbers are simulated; they are **not live inventory or valid airline documents**. This project is independent and not affiliated with Amadeus IT Group.

## What works

- Responsive terminal with command recall (↑/↓), quick commands, clear output, reset and multiple independent sessions.
- Deterministic local PNR state for availability (`AN`, `AD`, `SN`), sale (`SS`), names (`NM`), contact (`AP`, `APE`), ticketing arrangements (`TK`), received-from (`RF`), retrieve/save (`RT`, `ER`, `ET`), pricing (`FXP`, `FXX`, `FQD`, `FQN`), simulated issue/void (`TTP`, `TRDC`), cancel (`XE`, `XI`), SSR/OSI, remarks, basic queues, airport information (`DD`), currency examples (`DC`) and help.
- Live PNR inspector and guided training workflow.
- Sessions and command logs persist **only in this browser's localStorage**. No database, login or cross-device sync is currently included. Clearing site data removes sessions. Do not use real passenger personal information.
- Unknown commands and free-form questions are routed to OpenAI when configured. AI can explain but **cannot mutate PNR state**. Core booking operations remain available without an API key.

## Configuration

Copy `.env.example` to `.env` and set `OPENAI_API_KEY` on your development server, or configure it as a **server-side** environment variable on your deployment provider. Optionally set `OPENAI_MODEL` (default `gpt-4o-mini`). Never set a `VITE_`-prefixed key. The browser calls `/api/assist`; only the backend talks to OpenAI. The status endpoint exposes only a boolean, never the key. When the key is missing or invalid, the app displays an error and built-in simulator commands remain usable.

## Development and deployment

The app uses React, TypeScript, Tailwind CSS, Vite and Nitro. A developer cloning the repository can install dependencies with the project's package manager and run its `dev` script; end users need **only a browser** and need not install Node.js. Run the `build` script to build the production app. Commit the repository to GitHub and deploy it to a **Nitro-compatible full-stack host** (for example Vercel with its Vite + Nitro integration). Configure `OPENAI_API_KEY` and optionally `OPENAI_MODEL` in that host's server environment settings and redeploy. Enable HTTPS. Confirm `/api/status` and `/api/assist` resolve as server routes in the deployed app. A static-only host such as GitHub Pages cannot securely host this API. The project does not include a static-host API fallback.

Do not create a blanket SPA rewrite that sends `/api/*` requests to `index.html`: Nitro must handle those requests. For a high-traffic public deployment, add a provider-backed rate limit or abuse protection in front of `/api/assist`; the included in-process limiter is best-effort per server instance.

## Suggested training sequence

`AN15AUGDELBOM` → `SS3J2` → `NM1ACHE/KEYMON MR` → `AP DEL 9876543210` → `TKTL15AUG` → `RF JOHN` → `FXP` → `ER` → `RT` → `TTP`.

`ER` checks for passenger, itinerary, contact, ticketing arrangement and received-from. `TTP` additionally requires a saved locator and stored TST (`FXP`). `FXX` does not store a TST. Use **New session** to isolate booking state, **Clear** to erase only terminal output, or **Reset** to erase the current session's PNR and history. For help type `HELP`.

## Notes

No Supabase or Neon integration is configured by request. Consequently, account-based saving, database-backed persistence and cross-device retrieval are not supported yet; adding them requires a database and authentication. AI functionality requires a real OpenAI key and a deployed Nitro server; it cannot be verified against OpenAI without those credentials.
