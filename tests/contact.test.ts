import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { check, compose, mailDomainOk, mailer, POST, resetRateLimit } from '../api/contact.ts';

/* The contact form's sender: what it accepts, what it quietly drops, and what it hands Webhuset's
   SMTP server. No mail server is reached; the transport is replaced for each test. */

declare const process: { env: Record<string, string | undefined> };

const NOW = 1_000_000;
const good = { topic: 'event', name: 'Amina Hassan', email: 'amina@example.com', message: 'Assalamu alaykum, an invitation to Bergen.', website: '', loadedAt: String(NOW - 10_000) };

const realCreate = mailer.createTransport;
// No test reaches real DNS: every domain can take mail unless a test says otherwise.
mailer.domainOk = async () => true;
afterEach(() => {
  mailer.createTransport = realCreate;
  mailer.domainOk = async () => true;
  resetRateLimit();
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  delete process.env.CONTACT_TO;
});

type Sent = { options: Record<string, unknown>; mail: Record<string, unknown> };
/** Stands in for nodemailer: records what would be sent, or fails the way a real server can. */
const fakeSmtp = (fail?: Error) => {
  const sent: Sent[] = [];
  mailer.createTransport = ((options: Record<string, unknown>) => ({
    sendMail: async (mail: Record<string, unknown>) => {
      if (fail) throw fail;
      sent.push({ options, mail });
      return { messageId: 'x' };
    },
  })) as unknown as typeof mailer.createTransport;
  return sent;
};
const configure = () => {
  process.env.SMTP_USER = 'skjema@example.no';
  process.env.SMTP_PASS = 'hemmelig';
  process.env.CONTACT_TO = 'ali.private@example.com';
};

const post = (body: unknown, ip = '203.0.113.7') =>
  POST(new Request('http://localhost/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip }, body: typeof body === 'string' ? body : JSON.stringify(body) }));
const fresh = { ...good, loadedAt: '', elapsed: '20000' };

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

test("the time on the page is measured on the visitor's own clock, so a clock set wrong cannot hide a message", () => {
  // The page says it has been open 40 s; a load time from a clock an hour fast is ignored.
  assert.equal(check({ ...good, elapsed: '40000', loadedAt: String(NOW + 3_600_000) }, NOW).kind, 'ok');
  assert.equal(check({ ...good, elapsed: '1200' }, NOW).kind, 'spam');
  assert.equal(check({ ...good, elapsed: 'soon' }, NOW).kind, 'spam');
});

test('an unknown topic becomes "other", and a name cannot break onto a second line', () => {
  const r = check({ ...good, topic: 'constructor', name: 'Amina\r\nBcc: x@example.com' }, NOW);
  assert.equal(r.kind, 'ok');
  if (r.kind === 'ok') {
    assert.equal(r.message.topic, 'other');
    assert.doesNotMatch(compose(r.message).subject, /[\r\n]/);
  }
});

test('a good message leaves through Webhuset as the mailbox, with the visitor as Reply-To', async () => {
  configure();
  process.env.CONTACT_TO = 'ali.private@example.com, office@example.com';
  const sent = fakeSmtp();
  const res = await post(fresh);
  assert.equal(res.status, 200);
  assert.equal(sent.length, 1);
  const { options, mail } = sent[0];
  assert.equal(options.host, 'smtp.webhuset.no');
  assert.equal(options.port, 465);
  assert.equal(options.secure, true);
  assert.deepEqual(options.auth, { user: 'skjema@example.no', pass: 'hemmelig' });
  assert.deepEqual(mail.from, { name: 'alimohamedsalah.com', address: 'skjema@example.no' });
  assert.deepEqual(mail.to, ['ali.private@example.com', 'office@example.com']);
  assert.deepEqual(mail.replyTo, { name: 'Amina Hassan', address: 'amina@example.com' });
  assert.equal(mail.subject, 'Website: A lecture or event, from Amina Hassan');
  assert.match(String(mail.text), /invitation to Bergen/);
});

test('a bot is told it worked, and nothing is sent', async () => {
  configure();
  const sent = fakeSmtp();
  const res = await post({ ...fresh, website: 'x' });
  assert.equal(res.status, 200);
  assert.equal(sent.length, 0);
});

test('bad JSON is 400, an invalid message 422, missing settings 500, an SMTP failure 502', async () => {
  assert.equal((await post('{not json')).status, 400);
  assert.equal((await post({ ...fresh, email: 'x' })).status, 422);
  const none = fakeSmtp();
  assert.equal((await post(fresh)).status, 500);
  process.env.SMTP_USER = 'skjema@example.no';
  process.env.SMTP_PASS = '   ';
  process.env.CONTACT_TO = 'ali.private@example.com';
  assert.equal((await post(fresh)).status, 500, 'a blank password counts as missing');
  assert.equal(none.length, 0);

  configure();
  fakeSmtp(Object.assign(new Error('Invalid login: 535 Authentication failed'), { code: 'EAUTH' }));
  const res = await post(fresh);
  assert.equal(res.status, 502);
  assert.deepEqual(await res.json(), { error: 'send-failed' });
});

test('five sends per address per quarter hour; the sixth is refused, another address is not', async () => {
  configure();
  const sent = fakeSmtp();
  for (let i = 0; i < 5; i++) assert.equal((await post(fresh)).status, 200);
  const sixth = await post(fresh);
  assert.equal(sixth.status, 429);
  assert.equal((await post(fresh, '198.51.100.9')).status, 200);
  assert.equal(sent.length, 6);
});

/* Can the domain after the @ receive mail? The same rule as iqrasti.no (lib/kontakt/domene.ts). */
const err = (code: string) => Object.assign(new Error(code), { code });
const dns = (o: { mx?: () => Promise<{ exchange: string }[]>; a?: () => Promise<string[]>; aaaa?: () => Promise<string[]> }) => ({
  resolveMx: o.mx ?? (() => Promise.reject(err('ENODATA'))),
  resolve4: o.a ?? (() => Promise.reject(err('ENODATA'))),
  resolve6: o.aaaa ?? (() => Promise.reject(err('ENODATA'))),
});

test('a domain with a mail server passes', async () => {
  assert.equal(await mailDomainOk('gmail.com', dns({ mx: async () => [{ exchange: 'gmail-smtp-in.l.google.com' }] })), true);
});

test('a domain that does not exist (gmail.con) or takes no mail (null MX) is refused', async () => {
  assert.equal(await mailDomainOk('gmail.con', dns({ mx: () => Promise.reject(err('ENOTFOUND')) })), false);
  assert.equal(await mailDomainOk('example.com', dns({ mx: async () => [{ exchange: '.' }] })), false);
  assert.equal(await mailDomainOk('example.com', dns({ mx: async () => [{ exchange: '' }] })), false);
});

test('no MX but an address record still takes mail; nothing at all is refused', async () => {
  assert.equal(await mailDomainOk('liten.no', dns({ a: async () => ['192.0.2.1'] })), true);
  assert.equal(await mailDomainOk('liten.no', dns({ aaaa: async () => ['2001:db8::1'] })), true);
  assert.equal(await mailDomainOk('tom.no', dns({})), false);
});

test('when DNS itself is in trouble the writer is not blocked', async () => {
  for (const code of ['ETIMEOUT', 'ESERVFAIL', 'ECONNREFUSED']) {
    assert.equal(await mailDomainOk('kari.no', dns({ mx: () => Promise.reject(err(code)) })), true, code);
  }
});

test('an address on a domain that cannot take mail comes back as an email error, and nothing is sent', async () => {
  configure();
  const sent = fakeSmtp();
  let asked = '';
  mailer.domainOk = async (d) => ((asked = d), false);
  const res = await post({ ...fresh, email: 'amina@gmail.con' });
  assert.equal(res.status, 422);
  assert.equal(asked, 'gmail.con');
  const body = await res.json();
  assert.deepEqual(Object.keys(body.errors), ['email']);
  assert.equal(sent.length, 0);
});

test('a bot is never looked up', async () => {
  let looked = false;
  mailer.domainOk = async () => ((looked = true), true);
  await post({ ...fresh, website: 'x' });
  assert.equal(looked, false);
});
