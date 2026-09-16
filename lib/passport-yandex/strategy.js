'use strict';

const OAuth2Strategy = require('passport-oauth2');
const { InternalOAuthError } = require('passport-oauth2');
const util = require('node:util');

function Strategy(options, verify) {
  options = options || {};
  const settings = {
    ...options,
    authorizationURL: options.authorizationURL || 'https://oauth.yandex.ru/authorize',
    tokenURL: options.tokenURL || 'https://oauth.yandex.ru/token',
    state: options.state === undefined ? true : options.state,
    pkce: options.pkce === undefined ? 'S256' : options.pkce
  };
  OAuth2Strategy.call(this, settings, verify);
  this.name = 'yandex';
  this._yandexOptions = { ...settings };
  this._oauth2.setAuthMethod('OAuth');
  this._oauth2.useAuthorizationHeaderforGET(true);
}

util.inherits(Strategy, OAuth2Strategy);

Strategy.prototype.authorizationParams = function(options) {
  const settings = { ...this._yandexOptions, ...options };
  const params = {};
  for (const key of ['login_hint', 'force_confirm', 'optional_scope', 'device_id', 'device_name']) {
    if (settings[key] !== undefined) {
      params[key] = Array.isArray(settings[key]) ? settings[key].join(' ') : String(settings[key]);
    }
  }
  return params;
};

Strategy.prototype.tokenParams = function(options) {
  const settings = { ...this._yandexOptions, ...options };
  const params = {};
  for (const key of ['device_id', 'device_name']) {
    if (settings[key] !== undefined) params[key] = String(settings[key]);
  }
  return params;
};

Strategy.prototype.userProfile = function(accessToken, done) {
  this._oauth2.get('https://login.yandex.ru/info?format=json', accessToken, (err, body) => {
    if (err) return done(new InternalOAuthError('Failed to fetch user profile', err));
    let profile;
    try {
      const json = JSON.parse(body);
      if (!json || typeof json !== 'object' || Array.isArray(json) ||
          typeof json.id !== 'string' || !json.id.trim()) {
        throw new TypeError('Invalid Yandex profile: missing string id');
      }
      const nonempty = value => typeof value === 'string' && value.length > 0;
      profile = {
        provider: 'yandex',
        id: json.id,
        name: {},
        emails: [],
        photos: [],
        _raw: body,
        _json: json
      };
      if (nonempty(json.login)) profile.username = json.login;
      const displayName = [json.display_name, json.real_name, json.login].find(nonempty);
      if (displayName) profile.displayName = displayName;
      if (nonempty(json.first_name)) profile.name.givenName = json.first_name;
      if (nonempty(json.last_name)) profile.name.familyName = json.last_name;
      if (json.sex === 'male' || json.sex === 'female') profile.gender = json.sex;
      if (nonempty(json.psuid)) profile.psuid = json.psuid;
      const emails = [json.default_email, ...(Array.isArray(json.emails) ? json.emails : [])];
      profile.emails = [...new Set(emails.filter(nonempty))].map(value => ({ value }));
      if (json.is_avatar_empty !== true && nonempty(json.default_avatar_id)) {
        // Avatar IDs may contain a slash separating the namespace and image ID.
        const avatar = json.default_avatar_id.split('/').map(encodeURIComponent).join('/');
        profile.photos = [{
          value: 'https://avatars.yandex.net/get-yapic/' + avatar + '/islands-200',
          type: 'thumbnail'
        }];
      }
    } catch (error) {
      return done(error);
    }
    return done(null, profile);
  });
};

module.exports = Strategy;
