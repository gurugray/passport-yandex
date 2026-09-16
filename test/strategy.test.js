'use strict';
const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const nock = require('nock');
const { Strategy, version } = require('..');
const options = { clientID: 'client', clientSecret: 'secret', callbackURL: 'https://app.example/callback' };
const profile = { id: '000123', login: 'login', display_name: 'Display', first_name: 'Иван Пётр', last_name: 'Иванов', real_name: 'Wrong Order', sex: 'male', emails: ['other@example.test', 'main@example.test'], default_email: 'main@example.test', default_avatar_id: '0/0-0', psuid: 'pairwise' };
function strategy(extra = {}, verify = (a, r, p, done) => done(null, p)) { return new Strategy({ ...options, ...extra }, verify); }
function load(s = strategy()) { return new Promise((resolve, reject) => s.userProfile('token', (e, p) => e ? reject(e) : resolve(p))); }
function info(body = profile, status = 200) {
  return nock('https://login.yandex.ru', { reqheaders: { authorization: 'OAuth token' } }).get('/info').query({ format: 'json' }).reply(status, body);
}
function authenticate(s, query = {}, session = {}, extra = {}) {
  return new Promise((resolve, reject) => {
    const instance = Object.create(s);
    instance.redirect = location => resolve({ location });
    instance.success = (user, info) => resolve({ user, info });
    instance.fail = (info, status) => resolve({ failure: info, status });
    instance.error = reject;
    instance.authenticate({ query, session }, extra);
  });
}
nock.disableNetConnect();
afterEach(() => { const pending = nock.pendingMocks(); nock.cleanAll(); assert.deepEqual(pending, []); });

test('exports, defaults and immutable caller options', () => {
  const input = Object.freeze({ ...options });
  const s = new Strategy(input, () => {});
  assert.equal(s.name, 'yandex');
  assert.equal(typeof version, 'string');
  assert.equal(s._pkceMethod, 'S256');
  assert.throws(() => strategy({ state: false }), /state/);
  const defaults = strategy({ state: undefined, pkce: undefined });
  assert.equal(defaults._pkceMethod, 'S256');
  assert.notEqual(defaults._stateStore.constructor.name, 'NullStore');
});
test('profile uses OAuth header, never a token query, and normalizes fields', async () => {
  info(); const p = await load();
  assert.equal(p.id, '000123'); assert.equal(p.username, 'login'); assert.equal(p.displayName, 'Display');
  assert.deepEqual(p.name, { givenName: 'Иван Пётр', familyName: 'Иванов' });
  assert.deepEqual(p.emails, [{ value: 'main@example.test' }, { value: 'other@example.test' }]);
  assert.equal(p.photos[0].value, 'https://avatars.yandex.net/get-yapic/0/0-0/islands-200');
  assert.equal(p.psuid, 'pairwise'); assert.deepEqual(JSON.parse(p._raw), p._json);
});
test('minimal profile and empty avatar are supported', async () => {
  info({ id: '1', login: 'login', sex: null, is_avatar_empty: true, default_avatar_id: 'avatar' });
  const p = await load(); assert.deepEqual(p.name, {}); assert.deepEqual(p.emails, []); assert.deepEqual(p.photos, []);
  assert.equal(p.displayName, 'login'); assert.equal(p.gender, undefined);
});
for (const body of ['not json', 'null', '[]', '{}', '{"id":123}']) {
  test('rejects malformed profile: ' + body, async () => { info(body); await assert.rejects(load()); });
}
test('wraps HTTP errors', async () => { info({ error: 'invalid_token' }, 401); await assert.rejects(load(), { name: 'InternalOAuthError' }); });
test('does not invoke callback again if consumer throws', () => {
  const s = strategy(); let calls = 0;
  s._oauth2.get = (url, token, done) => done(null, JSON.stringify(profile));
  assert.throws(() => s.userProfile('token', () => { calls++; throw new Error('consumer'); }), /consumer/);
  assert.equal(calls, 1);
});
test('full code exchange validates state and PKCE, preserves token results, rejects replay', async () => {
  let tokenResults;
  const s = strategy({ scope: ['login:info', 'login:email'], optional_scope: ['login:avatar'], device_id: 'device123' },
    function(a, r, params, p, done) { assert.equal(r, 'refresh'); tokenResults = params; done(null, p); });
  const session = {};
  const start = await authenticate(s, {}, session, { login_hint: 'hint', force_confirm: true });
  const url = new URL(start.location);
  assert.equal(url.origin + url.pathname, 'https://oauth.yandex.ru/authorize');
  assert.equal(url.searchParams.get('scope'), 'login:info login:email');
  assert.equal(url.searchParams.get('optional_scope'), 'login:avatar');
  assert.equal(url.searchParams.get('login_hint'), 'hint');
  assert.equal(url.searchParams.get('force_confirm'), 'true');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  const state = url.searchParams.get('state'); assert.ok(state);
  nock('https://oauth.yandex.ru').post('/token', body => {
    assert.equal(body.grant_type, 'authorization_code'); assert.equal(body.code, 'code');
    assert.equal(body.client_id, 'client'); assert.equal(body.client_secret, 'secret');
    assert.equal(body.redirect_uri, options.callbackURL); assert.equal(body.device_id, 'device123');
    assert.equal(createHash('sha256').update(body.code_verifier).digest('base64url'), url.searchParams.get('code_challenge'));
    return true;
  }).matchHeader('content-type', 'application/x-www-form-urlencoded').reply(200, { access_token: 'token', refresh_token: 'refresh', expires_in: 3600 });
  info(); const result = await authenticate(s, { code: 'code', state }, session);
  assert.equal(result.user.id, '000123'); assert.equal(tokenResults.expires_in, 3600);
  assert.equal((await authenticate(s, { code: 'code', state }, session)).status, 403);
});
for (const badState of [undefined, 'wrong']) {
  test('rejects invalid state before token exchange: ' + badState, async () => {
    const s = strategy(); const session = {}; await authenticate(s, {}, session);
    assert.equal((await authenticate(s, { code: 'code', state: badState }, session)).status, 403);
  });
}
test('requires session by default', async () => { await assert.rejects(authenticate(strategy(), {}, null), /session/); });
test('handles provider denial and authorization error', async () => {
  assert.ok('failure' in await authenticate(strategy(), { error: 'access_denied' }));
  await assert.rejects(authenticate(strategy(), { error: 'unauthorized_client' }), { name: 'AuthorizationError' });
});
for (const reply of [{ error: 'invalid_grant' }, 'not json', {}]) {
  test('handles token error or missing token: ' + JSON.stringify(reply), async () => {
    const s = strategy(); const session = {}; const start = await authenticate(s, {}, session);
    const state = new URL(start.location).searchParams.get('state');
    nock('https://oauth.yandex.ru').post('/token').reply(reply.error ? 400 : 200, reply);
    await assert.rejects(authenticate(s, { code: 'code', state }, session));
  });
}
