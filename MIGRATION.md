# Migration from 0.0.x to 1.0

This is a breaking migration. The working version is `1.0.0-beta.0`; publication is
not part of the code migration. Preserve your application's existing Yandex IDs.

## Dependencies and runtime

- Use Node.js 22 or later and Passport 0.7.
- The strategy directly depends on passport-oauth2 1.8; passport-oauth and the
  unused OAuth1 dependency are removed. pkginfo is removed.
- CommonJS `require('passport-yandex').Strategy`, the `version` export and strategy
  name `yandex` are preserved.
- Type declarations ship with their required upstream type dependencies.

## State, PKCE and sessions

State validation and PKCE S256 are enabled by default. Install/configure
express-session before Passport middleware. `session: false` disables the login
session, not the state/verifier storage requirement. Applications with their own
state storage must provide a PKCE-aware `store`.

Do not use a literal authenticate `state` string with the default PKCE store.
Keep the same session across the redirect and callback. Behind an HTTPS proxy,
configure trusted proxies and cookies consistently. Use a separate `sessionKey`
when configuring multiple Yandex strategies for different OAuth clients.

For an application that intentionally supplies equivalent protection elsewhere,
the upstream opt-out is `{ state: false, pkce: false }`; do not use it as a fix for
a missing session store. Disabling state alone while PKCE is enabled throws.

## Profile changes

| Before | Now | Consumer action |
| --- | --- | --- |
| `username = display_name` | `username = login` | Use `displayName` for presentation |
| `real_name` split into surname/name | Explicit `first_name` / `last_name` | Remove assumptions about name order |
| Email object could contain `undefined` | Deduplicated valid string values or `[]` | Handle absence of email |
| Avatar emitted whenever ID exists | `is_avatar_empty` is respected | Handle `photos: []` |
| Missing profile ID could be accepted | Nonempty string ID required | Treat malformed profile as failed login |
| Unstructured declarations and string errors | Typed raw profile, Error callback, optional refresh token | Fix compile errors in consumers |

`id` is unchanged and remains a string. `psuid` is additional data, not a replacement
identity key. Continue looking up accounts by `provider + id`; do not recreate or
merge accounts using email or the newly corrected `username`. `name`, `emails` and
`photos` are always objects/arrays, even without the relevant permissions.

## Application changes

Passport 0.6+ regenerates sessions during login/logout and requires a callback for
`req.logout`. Use the [updated example](examples/login/app.js). Persist only the
session data your application needs; do not disable regeneration to preserve old
session assumptions. Secure POST logout against CSRF.

The example now uses Express 5, express-session and current EJS includes. It reads
credentials from environment variables and points to the local library. Production
apps must provide their own persistent session store and account persistence.

Check registered Redirect URIs and permissions before rollout. The strategy stays
on authorization code; Yandex's recommended instant-login JavaScript SDK is a
separate integration, not an automatic consequence of updating this package.

## Release checklist

1. Run `npm ci`, `npm ci --prefix examples/login`, and `npm test` on Node 22/24/26.
2. Run `npm pack`, install the tarball in a clean consumer, check CommonJS exports
   and compile a TypeScript consumer without development dependencies from this repo.
3. With a dedicated Yandex application, test successful login, denial, account
   switching, minimal permissions and a missing/invalid callback state.
4. Confirm that an existing user's stored Yandex ID still resolves to the same
   local account. Confirm that logout prevents access to protected pages.
5. Publish a beta using the `beta` dist-tag only after these checks and approval
   to publish. Promote to 1.0.0 after consumer validation.

A rollback restores the previous package and application configuration. No database
identity migration is required. Pending OAuth logins and sessions may need to be
restarted when switching versions; do not try to reuse pending PKCE state across
versions.

Sources checked on 2026-09-16:
- https://yandex.ru/dev/id/doc/ru/access
- https://yandex.ru/dev/id/doc/ru/codes/code-url
- https://yandex.ru/dev/id/doc/ru/user-information
- https://github.com/jaredhanson/passport/blob/master/CHANGELOG.md
