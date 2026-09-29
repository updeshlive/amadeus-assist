import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";

const requests = new Map<string, { count: number; expires: number }>();
const instructions = `You are a training assistant for a fictional Amadeus-style GDS simulator. All information is simulated, never live. Respond in concise uppercase cryptic terminal format where appropriate. Explain commands and errors helpfully. You may not claim to have booked, saved, canceled or ticketed anything. Structured PNR data provided is the only source of truth. Never invent changed PNR state, locators, fares, schedules or issued tickets. For unknown commands answer INVALID FORMAT with a short hint. End any travel information with SIMULATED DATA - TRAINING ONLY.`;

type RequestBody = { command?: string; pnr?: unknown; history?: { command: string; response: string }[] };

export default defineHandler(async (event) => {
  const body = await readBody<RequestBody>(event);
  if (!body || typeof body.command !== "string" || body.command.length > 300 || !Array.isArray(body.history)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid simulator request" });
  }
  const client = event.req.ip || 'anonymous';
  const now = Date.now();
  if (requests.size > 5000) requests.clear();
  const usage = requests.get(client);
  if (usage && usage.expires > now && usage.count >= 20) throw createError({ statusCode: 429, statusMessage: 'AI request limit reached. Try again in a minute.' });
  requests.set(client, { count: usage && usage.expires > now ? usage.count + 1 : 1, expires: usage && usage.expires > now ? usage.expires : now + 60000 });
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw createError({ statusCode: 503, statusMessage: "AI is not configured. Set OPENAI_API_KEY on the server; built-in simulation is still available." });
  }
  const context = JSON.stringify(body.pnr ?? {}).slice(0, 12000);
  const history = body.history.slice(-8).map((item) => ({
    role: "user" as const,
    content: `COMMAND: ${String(item.command).slice(0, 300)}\nTERMINAL RESPONSE: ${String(item.response).slice(0, 1200)}`,
  }));
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 350,
        messages: [
          { role: "system", content: instructions },
          ...history,
          { role: "user", content: `PNR SNAPSHOT (read-only): ${context}\nCURRENT COMMAND: ${body.command}` },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw createError({ statusCode: 502, statusMessage: "AI service unavailable. Try again; built-in simulator commands continue to work." });
  }
  if (!response.ok) {
    throw createError({ statusCode: response.status === 429 ? 429 : 502, statusMessage: response.status === 429 ? "AI rate limit reached. Try again shortly." : response.status === 401 ? "AI key is invalid. Check the server OPENAI_API_KEY." : "AI service returned an error. Built-in commands still work." });
  }
  const data = await response.json() as { choices?: { message?: { content?: string } }[] };
  return { response: (data.choices?.[0]?.message?.content || "INVALID FORMAT - TYPE HELP FOR COMMANDS").slice(0, 4000) };
});
