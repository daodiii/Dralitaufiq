import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { check, compose, POST } from '../api/contact.ts';

/* The contact form's sender: what it accepts, what it quietly drops, and what it hands Resend.
   Resend itself is never called; fetch is replaced for each test. */

declare const process: { env: Record<string, string | undefined> };

const NOW = 1_000_000;
const good = { topic: 'event', name: 'Amina Hassan', email: 'amina@example.com', message: 'Assalamu alaykum, an invitation to Bergen.', website: '', loadedAt: String(NOW - 10_000) };

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.RESEND_API_KEY;
  delete process.env.CONTACT_TO;
  delete process.env.CONTACT_FROM;
});

const post = (body: unknown) =>
  POST(new Request('http://localhost/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) }));

test('a complete message passes, trimmed', () => {
  const r = check({ ...good, name: '  Amina Hassan ' }, NOW);
  assert.equal(r.kind, 'ok');
  if (r.kind === 'ok') assert.equal(r.message.name, 'Amina Hassan');
});

test('missing or wrong fields come back as errors, one per field', () => {
  const r = check({ ...good, name: '', email: 'amina@', message: 'hi' }, NOW);
  assert.equal(r.kind, 'invalid');
  if (r.kind === 'invalid') assert.deepEqual(Object.keys(r.errors).sort(), ['email', 'message', 'name']);
});

test('over-long fields are refused', () => {
  const r = check({ ...good, name: 'a'.repeat(101), message: 'b'.repeat(5001) }, NOW);
  assert.equal(r.kind, 'invalid');
  if (r.kind === 'invalid') assert.deepEqual(Object.keys(r.errors).sort(), ['message', 'name']);
});

test('the hidden field filled, a send within 3 seconds, or no load time is taken for a bot', () => {
  assert.equal(check({ ...good, website: 'http://spam.example' }, NOW).kind, 'spam');
  assert.equal(check({ ...good, loadedAt: String(NOW - 1000) }, NOW).kind, 'spam');
  assert.equal(check({ ...good, loadedAt: '' }, NOW).kind, 'spam');
});

test('an unknown topic becomes "other", and a name cannot break onto a second line', () => {
  const r = check({ ...good, topic: 'constructor', name: 'Amina\r\nBcc: x@example.com' }, NOW);
  assert.equal(r.kind, 'ok');
  if (r.kind === 'ok') {
    assert.equal(r.message.topic, 'other');
    assert.doesNotMatch(compose(r.message).subject, /[\r\n]/);
  }
});

test('a good message goes to Resend with the visitor as Reply-To', async () => {
  process.env.RESEND_API_KEY = 're_test';
  process.env.CONTACT_TO = 'office@example.com, ali@example.com';
  let sent: { url: string; init: RequestInit } | undefined;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    sent = { url, init };
    return new Response('{"id":"x"}', { status: 200 });
  }) as typeof fetch;

  const res = await post({ ...good, loadedAt: String(Date.now() - 10_000) });
  assert.equal(res.status, 200);
  assert.equal(sent?.url, 'https://api.resend.com/emails');
  assert.equal((sent?.init.headers as Record<string, string>).Authorization, 'Bearer re_test');
  const body = JSON.parse(String(sent?.init.body));
  assert.deepEqual(body.to, ['office@example.com', 'ali@example.com']);
  assert.equal(body.reply_to, 'amina@example.com');
  assert.equal(body.subject, 'Website: A lecture or event, from Amina Hassan');
  assert.match(body.text, /invitation to Bergen/);
});

test('a bot is told it worked, and nothing is sent', async () => {
  process.env.RESEND_API_KEY = 're_test';
  process.env.CONTACT_TO = 'office@example.com';
  let called = false;
  globalThis.fetch = (async () => ((called = true), new Response('{}'))) as typeof fetch;
  const res = await post({ ...good, website: 'x', loadedAt: String(Date.now() - 10_000) });
  assert.equal(res.status, 200);
  assert.equal(called, false);
});

test('bad JSON is 400, an invalid message 422, missing settings 500, a Resend failure 502', async () => {
  assert.equal((await post('{not json')).status, 400);
  assert.equal((await post({ ...good, email: 'x', loadedAt: String(Date.now() - 10_000) })).status, 422);
  assert.equal((await post({ ...good, loadedAt: String(Date.now() - 10_000) })).status, 500);

  process.env.RESEND_API_KEY = 're_test';
  process.env.CONTACT_TO = 'office@example.com';
  globalThis.fetch = (async () => new Response('{"message":"domain not verified"}', { status: 403 })) as typeof fetch;
  assert.equal((await post({ ...good, loadedAt: String(Date.now() - 10_000) })).status, 502);
});
