# Amadeus Assist

A browser-based **educational GDS simulator**, not affiliated with Amadeus IT Group. Flight schedules, inventory, fares, PNR locators, and ticket numbers are fictional and **never represent live bookings or issued tickets**.

## Features

- Responsive dark cryptic terminal inside a light travel-operations workspace.
- Deterministic PNR state for availability, selling, names, contact, ticketing arrangements, received-from, pricing, save/retrieve, cancellation, SSR/OSI and remarks.
- AI-powered answers for unfamiliar commands and training questions through a **server-only** OpenRouter Nemotron endpoint. The AI cannot mutate booking state.
- Multiple isolated sessions and command histories saved in **this browser's local storage**. Up/Down arrows recall recent commands. Clearing terminal output preserves the PNR; resetting a session clears it.
- Live PNR inspector and optional guided booking exercise.

## Getting started

Clone the repository, install dependencies with your preferred Node package manager, and start the Vite development server. No setup is needed for end users: they use the published website in a browser. Copy `.env.example` to `.env` and add a **new server-side OpenRouter key** as `OPENROUTER_API_KEY` to enable AI. You can override `OPENROUTER_MODEL` if your OpenRouter account has access to a different Nemotron model (default: `nvidia/nemotron-3.5-lightning:free`). The built-in GDS simulation works without the key; AI questions then show a helpful configuration message.

Development: `npm install` then `npm run dev`.
Production build: `npm run build`.

> **Never** prefix the API key with `VITE_`, put it into React code, or publish `.env`. The browser calls `/api/ai`, and only the Nitro server calls OpenRouter. The `/api/ai-status` endpoint reports a boolean, not a secret. Revoke any key that has been shared in chat or public text and use a replacement key.

## Deploying

This project uses React/Vite plus a Nitro server layer configured for the Vercel serverless preset. Import the GitHub repository into Vercel, use the repository build command (`npm run build`), and set a fresh `OPENROUTER_API_KEY` (and optionally `OPENROUTER_MODEL`) under the project's **server environment variables**. Nitro emits both client assets and serverless API routes. Connect an HTTPS domain as usual. Do **not** deploy the `public` directory to a static-only host such as GitHub Pages: the AI API requires a running server function.

The repository does not include provider-specific credentials. Publish only after setting the server secret and confirming `/api/ai-status` returns `{ "connected": true }` and an unfamiliar command receives an AI response. Browser sessions are device-local and will not sync between devices.

## Supported command workflow

```text
AN15AUGDELBOM         Search simulated availability
SS2J3                 Sell two J seats from availability line 3
NM1ACHE/KEYMON MR     Add passenger
AP DEL 9876543210     Add contact
TKTL15AUG             Set ticketing arrangement
RF JOHN               Received from
FXP                   Price and store simulated fare
ER                    End transaction, generate fictional locator, retrieve
RT                    Display same active PNR
TTP                   Issue fictional electronic ticket numbers (only after save + pricing)
```

Additional supported commands include `AD`, `FXX`, `FQD`, `FQN`, `TRDC`, `XE`, `XI`, `SR`, `OS`, `RM`, `RC`, `RI`, `QE`, `QS`, `QN`, `DD`, `DC`, `HELP`, `IG`, `IR`, and `ET`. Some commands are simplified for training. Type `HELP` in the terminal for examples.

## Current limitations

- You requested **no Supabase or Neon integration for now**. As a result, there are no accounts, authentication, server-stored sessions or cross-device persistence. Local storage is not secure shared storage; do not enter real customer personal data. The application intentionally labels the workspace as guest mode. Account-based syncing requires a database and authentication integration later.
- Simulated schedules and fares are illustrative; they do not correspond to real inventory or real market pricing.
- AI availability depends on the configured OpenRouter account, Nemotron model access, key validity, quota and network connectivity; known simulator commands remain functional without AI.

## Structure

- `src/pages/Index.tsx`: terminal, session controls, inspector, training UI
- `src/lib/gdsEngine.ts`: deterministic command and PNR behavior
- `src/lib/gdsConstants.ts`, `src/types/gds.ts`: mock data, interfaces and session factory
- `server/routes/api/`: secure OpenRouter and AI-status endpoints
- `nitro.config.ts`: server deployment preset
