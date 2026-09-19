# Passport-Yandex

Yandex ID OAuth 2.0 authentication strategy for [Passport](https://www.passportjs.org/).
Requires Node.js 22 or later. Tested with Passport 0.7 and passport-oauth2 1.8.

This strategy uses the server-side authorization-code flow with **state validation
and PKCE S256 enabled by default**. Yandex still documents this flow, but recommends
its JavaScript instant-login SDK for new web integrations. That SDK is a separate
integration; this package implements the redirect-based Passport flow.

- [Yandex authentication methods](https://yandex.ru/dev/id/doc/ru/access)
- [Authorization code and PKCE](https://yandex.ru/dev/id/doc/ru/codes/code-url)
- [Profile API](https://yandex.ru/dev/id/doc/ru/user-information)
- [Migrating from 0.0.x](MIGRATION.md)

## Install

```sh
npm install passport-yandex passport express express-session
```

The repository currently targets `1.0.0-beta.0`. Until that release is published,
use a local checkout or its `npm pack` tarball; installing by name may resolve to
the previous published version.

## Configure

Register an application in [Yandex OAuth](https://oauth.yandex.ru/), configure its
Redirect URI, and enable only the permissions needed by your application.
The callback URL must match a registered URI. Use HTTPS in production.

```js
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const { Strategy: YandexStrategy } = require('passport-yandex');
const app = express();

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: true }
  // Configure a persistent session store in production.
}));
app.use(passport.initialize());
app.use(passport.session());

passport.use(new YandexStrategy({
  clientID: process.env.YANDEX_CLIENT_ID,
  clientSecret: process.env.YANDEX_CLIENT_SECRET,
  callbackURL: process.env.YANDEX_CALLBACK_URL,
  scope: ['login:info', 'login:email'],
  state: true,
  pkce: 'S256'
}, function(accessToken, refreshToken, profile, done) {
  // Implement this lookup in your application. Identify by provider + id,
  // not username, display name or email.
  User.findOrCreate({ provider: profile.provider, providerId: profile.id })
    .then(user => done(null, user), done);
}));

// User is your application's model, not an export of this library.
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  User.findById(id).then(user => done(null, user || false), done);
});

app.get('/auth/yandex', passport.authenticate('yandex'));
app.get('/auth/yandex/callback',
  passport.authenticate('yandex', { failureRedirect: '/login' }),
  (req, res) => res.redirect('/account'));
```

The `secure: true` cookie above needs HTTPS. For local HTTP development use
`secure: false`; the runnable example handles this through `NODE_ENV`. Configure
Express `trust proxy` to match your actual trusted proxy topology if TLS is
terminated upstream.

OAuth state storage is required even when Passport login sessions are disabled
with `session: false`. The default store uses `req.session`. A custom `store` must
implement the passport-oauth2 PKCE state-store contract and retain the verifier.
Do not pass a literal string `state` to `passport.authenticate`: let the store
create and validate it. The default store supports one pending login per strategy
session key; concurrent login attempts in one session can invalidate earlier ones.

## Options

Standard passport-oauth2 options are forwarded, including `callbackURL`, `scope`,
`passReqToCallback`, `sessionKey`, `store`, `proxy`, `authorizationURL` and `tokenURL`.
Provider endpoint overrides must be trusted application configuration.

Additional Yandex options can be passed to the constructor or authenticate call:

| Option | Value |
| --- | --- |
| `login_hint` | Suggested login or email |
| `force_confirm` | `true`, `yes`, `true` as a string, or `1` as a string |
| `optional_scope` | Space-separated string or array of permission names |
| `device_id` | Device identifier |
| `device_name` | Device display name |

Scopes must be enabled for the OAuth application. Avoid including the same
permission in both `scope` and `optional_scope`: Yandex treats it as optional.
Device parameters are sent to both authorization and token endpoints when set in
the constructor. Per-request device options must be provided on both routes;
they are not automatically persisted between requests.

## Profile

Profile retrieval uses `Authorization: OAuth <token>`, never a token query parameter.
Only fields permitted by the token are available.

| Property | Source |
| --- | --- |
| `provider` | Always `yandex` |
| `id` | Yandex `id`, preserved as a string |
| `username` | `login` |
| `displayName` | First nonempty `display_name`, `real_name`, or `login` |
| `name.givenName`, `name.familyName` | `first_name`, `last_name` |
| `gender` | `male` or `female`; omitted if unknown |
| `emails` | Unique nonempty addresses, default email first |
| `photos` | Avatar thumbnail when `default_avatar_id` is nonempty and `is_avatar_empty` is not true |
| `psuid` | Optional application-specific identifier; does not replace `id` |
| `_raw`, `_json` | Original JSON response and parsed response |

`name`, `emails` and `photos` are always present, possibly empty. Missing optional
fields are normal. Missing or non-string `id`, invalid JSON and HTTP errors fail
profile loading. Do not log raw profiles or tokens.

## Token lifecycle and callbacks

The standard callback is `(accessToken, refreshToken, profile, done)`.
`refreshToken` may be undefined. To inspect expiration and granted scopes, use
`(accessToken, refreshToken, results, profile, done)`; with `passReqToCallback: true`,
prepend `req`. Use ordinary declared parameters: passport-oauth2 selects these
signatures using the function's arity. Return `done(null, false)` to reject login,
or `done(error)` for an error.

The strategy does not persist or automatically refresh tokens. If your application
needs Yandex APIs after login, store credentials securely on the server, use token
expiration metadata, and implement refresh/re-authorization in the application.
Passport logout ends the local login session; it does not revoke the Yandex token.

TypeScript declarations are included. They describe the normal profile-loading
flow; `skipUserProfile: true` is not included in the typed configuration because
it removes the profile from the verify callback.

## Runnable example

```sh
npm ci
npm ci --prefix examples/login
export YANDEX_CLIENT_ID='your-client-id'
export YANDEX_CLIENT_SECRET='your-client-secret'
export SESSION_SECRET='a-long-random-secret'
export YANDEX_CALLBACK_URL='http://127.0.0.1:3000/auth/yandex/callback'
npm start --prefix examples/login
```

Register that exact callback URL and enable `login:info`. Open
[the local example](http://127.0.0.1:3000). The example uses a local package link,
minimal session data, escaped EJS output and a POST logout with a CSRF token.
Its in-memory session store is for development only. Configure persistent storage
and a database-backed user lookup for production.

## Development

```sh
npm ci
npm ci --prefix examples/login
npm test
npm pack --dry-run
```

Tests use Node's test runner, HTTP mocks and a loopback server. They cover profile
mapping, OAuth headers, state, PKCE, token errors, Passport sessions and TypeScript.
No Yandex credentials are required. CI runs on Node 22, 24 and 26. A real Yandex
application is still required for a live acceptance test before publishing.

## License

MIT. Original implementation by [Sergii Serieiev](https://gray.guru), based on Passport by Jared Hanson.
See [LICENSE](LICENSE).
