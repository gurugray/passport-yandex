'use strict';
const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const nock = require('nock');
const { createApp } = require('../examples/login/app');
nock.disableNetConnect();
nock.enableNetConnect('127.0.0.1');
afterEach(() => { const pending = nock.pendingMocks(); nock.cleanAll(); assert.deepEqual(pending, []); });
async function agentFor(t) {
  const app = createApp({ clientID: 'client', clientSecret: 'secret', sessionSecret: 'test-session-secret', callbackURL: 'http://127.0.0.1/auth/yandex/callback' });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  return request.agent(server);
}

test('Passport 0.7 login regenerates session, persists user, renders templates and logs out', async (t) => {
  const agent = await agentFor(t);
  const beforeLogin = await agent.get('/account').expect(302).expect('Location', '/login');
  await agent.get('/login').expect(200).expect(/Continue with Yandex ID/);
  const start = await agent.get('/auth/yandex').expect(302);
  const state = new URL(start.headers.location).searchParams.get('state');
  nock('https://oauth.yandex.ru').post('/token').reply(200, { access_token: 'token', token_type: 'bearer' });
  nock('https://login.yandex.ru', { reqheaders: { authorization: 'OAuth token' } })
    .get('/info').query({ format: 'json' }).reply(200, { id: '001', login: '<script>alert(1)</script>' });
  const callback = await agent.get('/auth/yandex/callback').query({ code: 'code', state }).expect(302).expect('Location', '/account');
  assert.ok(callback.headers['set-cookie'], 'login sets a regenerated session cookie');
  assert.notEqual(callback.headers['set-cookie'][0].split(';')[0], beforeLogin.headers['set-cookie'][0].split(';')[0]);
  const account = await agent.get('/account').expect(200).expect(/ID: 001/);
  assert.ok(!account.text.includes('<script>'));
  const csrfToken = account.text.match(/name="csrfToken" value="([a-f0-9]+)"/)[1];
  await agent.post('/logout').type('form').send({ csrfToken: 'wrong' }).expect(403);
  await agent.get('/account').expect(200);
  await agent.post('/logout').type('form').send({ csrfToken }).expect(302).expect('Location', '/');
  await agent.get('/account').expect(302).expect('Location', '/login');
});
test('callback without state never authenticates', async (t) => {
  const agent = await agentFor(t);
  await agent.get('/auth/yandex').expect(302);
  await agent.get('/auth/yandex/callback?code=attacker').expect(302).expect('Location', '/login');
  await agent.get('/account').expect(302).expect('Location', '/login');
});
test('denied authorization returns to login', async (t) => {
  const agent = await agentFor(t);
  await agent.get('/auth/yandex/callback?error=access_denied').expect(302).expect('Location', '/login');
});
