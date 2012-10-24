/**
 * Module dependencies.
 */
var util = require('util')
  , OAuth2Strategy = require('passport-oauth').OAuth2Strategy
  , InternalOAuthError = require('passport-oauth').InternalOAuthError;


/**
 * `Strategy` constructor.
 *
 * The Yandex authentication strategy authenticates requests by delegating to
 * Yandex using the OAuth 2.0 protocol.
 *
 * Applications must supply a `verify` callback which accepts an `accessToken`,
 * `refreshToken` and service-specific `profile`, and then calls the `done`
 * callback supplying a `user`, which should be set to `false` if the
 * credentials are not valid.  If an exception occured, `err` should be set.
 *
 * Options:
 *   - `clientID`      your Yandex application's App ID
 *   - `clientSecret`  your Yandex application's App Secret
 *   - `callbackURL`   URL to which Yandex will redirect the user after granting authorization
 *
 * Examples:
 *
 *     passport.use(new YandexStrategy({
 *         clientID: '123-456-789',
 *         clientSecret: 'shhh-its-a-secret'
 *         callbackURL: 'https://www.example.net/auth/yandex/callback'
 *       },
 *       function(accessToken, refreshToken, profile, done) {
 *         User.findOrCreate(..., function (err, user) {
 *           done(err, user);
 *         });
 *       }
 *     ));
 *
 * @param {Object} options
 * @param {Function} verify
 * @api public
 */
function Strategy(options, verify) {
  options = options || {};
  options.authorizationURL = options.authorizationURL || 'https://oauth.yandex.ru/authorize';
  options.tokenURL = options.tokenURL || 'https://oauth.yandex.ru/token';

  OAuth2Strategy.call(this, options, verify);
  this.name = 'yandex';

  // NOTE: Due to OAuth 2.0 implementations arising at different points and
  //       drafts in the specification process, the parameter used to denote the
  //       access token is not always consistent.    As of OAuth 2.0 draft 22,
  //       the parameter is named "access_token".  However, yandex's
  //       implementation expects it to be named "oauth_token".  For further
  //       information, refer to: http://api.yandex.ru/oauth/doc/dg/concepts/ya-oauth-intro.xml
  this._oauth2.setAccessTokenName("oauth_token");
}

/**
 * Inherit from `OAuth2Strategy`.
 */
util.inherits(Strategy, OAuth2Strategy);


/**
 * Retrieve user profile from Yandex.
 *
 * This function constructs a normalized profile, with the following properties:
 *
 *   - `provider`         always set to `yandex`
 *   - `id`               unique identifier for this user.
 *   - `username`         the user's Yandex username
 *   - `displayName`      the user's auth username
 *   - `name.familyName`  user's last name
 *   - `name.givenName`   user's first name
 *   - `gender`           the user's gender: `male` or `female`
 *   - `emails`           the proxied or contact email address granted by the user
 *
 * @param {String} accessToken
 * @param {Function} done
 */
Strategy.prototype.userProfile = function(accessToken, done) {
  var url = 'https://login.yandex.ru/info?format=json';

  this._oauth2.get(url, accessToken, function (err, body, res) {
    if (err) { return done(new InternalOAuthError('failed to fetch user profile', err)); }

    try {
      var json = JSON.parse(body);

      var profile = { provider: 'yandex' };
      profile.id = json.id;
      profile.username = json.display_name;
      profile.displayName = json.display_name;
      if (json.real_name) {
        var tokens = json.real_name.split(' ', 2);
        profile.name = {familyName: tokens[0], givenName: tokens[1]};
      } else {
        profile.name = {};
      }
      profile.gender = json.sex;
      profile.emails = [{ value: json.default_email }];

      profile._raw = body;
      profile._json = json;

      done(null, profile);
    } catch(e) {
      done(e);
    }
  });
}


/**
 * Expose `Strategy`.
 */
module.exports = Strategy;
