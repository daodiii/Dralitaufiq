/* The contact form's sender, a Vercel Function beside the static site (src/pages/contact.astro
   posts here). It checks the message and emails it through Resend's HTTP API, with the visitor's
   address as Reply-To so a reply goes straight back to them.

   Environment (set in Vercel, Project → Settings → Environment Variables):
   - RESEND_API_KEY  the Resend API key
   - CONTACT_TO      where messages go; several addresses separated by commas
   - CONTACT_FROM    the sender, on a domain verified in Resend, e.g. "Website <post@alimohamedsalah.com>".
                     Until a domain is verified, Resend's "onboarding@resend.dev" only delivers to the
                     address that owns the Resend account.

   A bot that fills in the hidden "website" field, or sends within 3 seconds of the page loading,
   gets the same answer as a person but nothing is sent. */

declare const process: { env: Record<string, string | undefined> };

export const TOPICS: Record<string, string> = {
  event: 'A lecture or event',
  books: 'Books',
  question: 'A question',
  other: 'Something else',
};

export const LIMITS = { name: 100, email: 254, message: 5000, messageMin: 10 };
const FASTEST_MS = 3000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type Message = { topic: string; name: string; email: string; message: string };
export type Checked =
  | { kind: 'ok'; message: Message }
  | { kind: 'spam' }
  | { kind: 'invalid'; errors: Partial<Record<keyof Message, string>> };

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function check(body: unknown, now = Date.now()): Checked {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;

  const loadedAt = Number(text(b.loadedAt) || NaN);
  if (text(b.website) !== '' || !(loadedAt > 0) || now - loadedAt < FASTEST_MS) return { kind: 'spam' };

  // One line each, so nothing written in the name can reach the subject as a second header line.
  const name = text(b.name).replace(/\s+/g, ' ');
  const email = text(b.email);
  const message = text(b.message);
  const topic = Object.hasOwn(TOPICS, text(b.topic)) ? text(b.topic) : 'other';

  const errors: Partial<Record<keyof Message, string>> = {};
  if (!name) errors.name = 'Fill in your name.';
  else if (name.length > LIMITS.name) errors.name = 'The name is too long.';
  if (!EMAIL.test(email) || email.length > LIMITS.email) errors.email = 'This does not look like an email address.';
  if (message.length < LIMITS.messageMin) errors.message = 'Write a little more (at least 10 characters).';
  else if (message.length > LIMITS.message) errors.message = 'The message is too long.';

  return Object.keys(errors).length ? { kind: 'invalid', errors } : { kind: 'ok', message: { topic, name, email, message } };
}

export function compose({ topic, name, email, message }: Message) {
  return {
    subject: `Website: ${TOPICS[topic]}, from ${name}`,
    text: `${message}\n\n—\n${name} <${email}>\nTopic: ${TOPICS[topic]}\nSent from the contact page of alimohamedsalah.com`,
  };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'bad-request' });
  }

  const checked = check(body);
  if (checked.kind === 'spam') return json(200, { ok: true });
  if (checked.kind === 'invalid') return json(422, { error: 'invalid', errors: checked.errors });

  const key = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO?.split(',').map((s) => s.trim()).filter(Boolean);
  if (!key || !to?.length) {
    console.error('contact: RESEND_API_KEY or CONTACT_TO is not set');
    return json(500, { error: 'not-configured' });
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.CONTACT_FROM || 'Website <onboarding@resend.dev>',
      to,
      reply_to: checked.message.email,
      ...compose(checked.message),
    }),
  });
  if (!res.ok) {
    console.error('contact: Resend answered', res.status, await res.text());
    return json(502, { error: 'send-failed' });
  }
  return json(200, { ok: true });
}
