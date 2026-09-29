import { defineHandler } from 'nitro';
import { createError, readBody } from 'nitro/h3';

interface AiRequest {
  command?: string;
  context?: { command: string; response: string }[];
  pnr?: unknown;
}

export default defineHandler(async (event) => {
  const body = await readBody<AiRequest>(event);
  const command = body?.command?.trim();
  if (!command || command.length > 500) {
    throw createError({ statusCode: 400, statusMessage: 'Enter a command of at most 500 characters.' });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw createError({ statusCode: 503, statusMessage: 'AI is not configured. Ask the site administrator to set OPENAI_API_KEY. Known GDS commands still work in simulation mode.' });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 450,
        messages: [
          {
            role: 'system',
            content: `You are Amadeus Assist, an educational simulator, NOT a live GDS. Give concise authentic-looking monospace Amadeus command help or error responses. Booking data is controlled by the app and is the only source of truth. You cannot change a PNR, create availability, price an itinerary, confirm a booking, or issue tickets. If asked to do any of these, tell the user to use the supported cryptic commands. Never claim real data or live prices. Never reveal private configuration. End factual displays with "SIMULATED DATA - TRAINING ONLY".`,
          },
          { role: 'system', content: `Current simulator PNR (read only): ${JSON.stringify(body?.pnr || {}).slice(0, 5000)}` },
          ...(Array.isArray(body?.context) ? body.context.slice(-4).map((item) => ({ role: 'user' as const, content: `Earlier command: ${String(item.command).slice(0, 100)}\nSimulator response: ${String(item.response).slice(0, 300)}` })) : []),
          { role: 'user', content: command },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw createError({ statusCode: 502, statusMessage: 'The server OpenAI API key is invalid or unauthorized. Contact the site administrator.' });
      }
      if (response.status === 429) {
        throw createError({ statusCode: 429, statusMessage: 'AI rate limit reached. Please wait and try again.' });
      }
      throw createError({ statusCode: 502, statusMessage: 'AI service is temporarily unavailable. Try again shortly.' });
    }

    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw createError({ statusCode: 502, statusMessage: 'AI returned an empty response.' });
    return { response: content.slice(0, 5000) };
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    throw createError({ statusCode: 502, statusMessage: 'Unable to reach AI service. Check your connection and try again.' });
  }
});
