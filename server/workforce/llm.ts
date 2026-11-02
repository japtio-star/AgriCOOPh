import { GoogleGenAI } from '@google/genai';

// Thin wrapper over Gemini. When no API key is configured, callers supply a
// rule-based writer that composes text from the same real data, and the
// output is labelled as such. A configured key that fails raises an error, so
// the employee visibly enters the ERROR state instead of silently degrading.
// The key is read lazily because env files load after module imports.

let client: GoogleGenAI | null | undefined;

function getClient() {
  if (client === undefined) {
    const key = process.env.GEMINI_API_KEY;
    client = key && key !== 'MY_GEMINI_API_KEY' ? new GoogleGenAI({ apiKey: key }) : null;
  }
  return client;
}

export function llmInfo() {
  const mode: 'gemini' | 'rule-based' = getClient() ? 'gemini' : 'rule-based';
  return { mode, model: mode === 'gemini' ? process.env.WORKFORCE_MODEL || 'gemini-2.5-flash' : null };
}

export interface Generated {
  text: string;
  engine: 'gemini' | 'rule-based';
}

export async function generate(prompt: string, fallback: () => string): Promise<Generated> {
  const ai = getClient();
  if (!ai) return { text: fallback(), engine: 'rule-based' };
  let response;
  try {
    response = await ai.models.generateContent({ model: llmInfo().model!, contents: prompt });
  } catch (e: any) {
    throw new Error(`Gemini request failed: ${readableError(e)}`);
  }
  const text = response.text?.trim();
  if (!text) throw new Error('Gemini returned an empty response');
  return { text, engine: 'gemini' };
}

// The SDK often puts the API's JSON error body in the message; surface just the text.
function readableError(e: any): string {
  const raw = String(e?.message ?? e);
  try {
    return JSON.parse(raw.slice(raw.indexOf('{'))).error?.message ?? raw;
  } catch {
    return raw;
  }
}
