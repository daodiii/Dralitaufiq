/* The contact form's sender, a Vercel Function beside the static site (src/pages/contact.astro
   posts here). It checks the message and emails it through Webhuset's SMTP server, logged in to a
   real mailbox there, the same way as the Iqra Foundation site (iqrasti/iqra-foundation,
   lib/kontakt/handle.ts). The mail is From that mailbox, with the visitor as Reply-To, so pressing
   Reply answers them.

   Environment (set only in Vercel, Project -> Settings -> Environment Variables; never in the code):
   - SMTP_USER   the Webhuset mailbox's full address, e.g. "skjema@example.no"
   - SMTP_PASS   that mailbox's password
   - CONTACT_TO  where messages go; several addresses separated by commas

   A bot that fills in the hidden "website" field, or sends within 3 seconds of the page loading,
   gets the same answer as a person but nothing is sent. The page reports how long it has been open
   ("elapsed", in ms, measured on its own clock), so a visitor whose clock is set wrong is not taken
   for a bot. Pages from before that field send "loadedAt" (their clock) and are checked against ours. */

import nodemailer from 'nodemailer';

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

  const elapsed = text(b.elapsed) !== '' ? Number(text(b.elapsed)) : now - Number(text(b.loadedAt) || NaN);
  if (text(b.website) !== '' || !(elapsed >= FASTEST_MS)) return { kind: 'spam' };

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

/** The transport maker, replaceable in tests so no mail server is reached. */
export const mailer = { createTransport: nodemailer.createTransport.bind(nodemailer) };

/** Five sends per address per quarter hour. Kept in memory, so on Vercel each instance counts on its own. */
export const RATE = { max: 5, windowMs: 15 * 60 * 1000 };
const sends = new Map<string, number[]>();

export function resetRateLimit() {
  sends.clear();
}

function allow(ip: string, now: number) {
  const recent = (sends.get(ip) ?? []).filter((t) => now - t < RATE.windowMs);
  if (recent.length >= RATE.max) {
    sends.set(ip, recent);
    return false;
  }
  recent.push(now);
  sends.set(ip, recent);
  // Keep the map from growing without end: forget addresses whose sends have all aged out.
  if (sends.size > 5000) for (const [k, v] of sends) if (v.every((t) => now - t >= RATE.windowMs)) sends.delete(k);
  return true;
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

  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS; // as given: a password may begin or end with a space
  const to = process.env.CONTACT_TO?.split(',').map((s) => s.trim()).filter(Boolean);
  if (!user || !pass?.trim() || !to?.length) {
    console.error('contact: SMTP_USER, SMTP_PASS or CONTACT_TO is not set; the message was not sent');
    return json(500, { error: 'not-configured' });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  if (!allow(ip, Date.now())) {
    console.error('contact: rate limit reached for one address; the message was not sent');
    return json(429, { error: 'rate-limited' });
  }

  const transport = mailer.createTransport({
    host: 'smtp.webhuset.no',
    port: 465,
    secure: true,
    auth: { user, pass },
    // Fail plainly within the function's time rather than leave the button waiting.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  const { name, email } = checked.message;
  try {
    await transport.sendMail({
      from: { name: 'alimohamedsalah.com', address: user },
      to,
      replyTo: { name, address: email },
      ...compose(checked.message),
    });
  } catch (err) {
    console.error('contact: sending failed:', err instanceof Error ? err.message : err);
    return json(502, { error: 'send-failed' });
  }
  return json(200, { ok: true });
}
