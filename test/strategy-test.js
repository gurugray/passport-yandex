var vows = require('vows');
var assert = require('assert');
var util = require('util');
var YandexStrategy = require('passport-yandex/strategy');


vows.describe('YandexStrategy').addBatch({

  'strategy': {
    topic: function() {
      return new YandexStrategy({
        clientID: 'ABC123',
        clientSecret: 'secret'
      },
      function() {});
    },

    'should be named yandex': function (strategy) {
      assert.equal(strategy.name, 'yandex');
    },
  },

  'strategy when loading user profile': {
    topic: function() {
      var strategy = new YandexStrategy({
        clientID: 'ABC123',
        clientSecret: 'secret'
      },
      function() {});

      // mock
      strategy._oauth2.get = function(url, accessToken, callback) {
        if (url === 'https://login.yandex.ru/info?format=json') {
            var body = '{ "display_name": "TestUser", "id": "00000000", "sex": "male", "emails": ["testuser@yandex.ru"], "default_email": "TestUser@yandex.ru", "real_name": "User Test"}';
          callback(null, body, undefined);
        } else {
          callback(new Error('invalid user profile URL'));
        }
      }

      return strategy;
    },

    'when told to load user profile': {
      topic: function(strategy) {
        var self = this;
        function done(err, profile) {
          self.callback(err, profile);
        }

        process.nextTick(function () {
          strategy.userProfile('access-token', done);
        });
      },

      'should not error' : function(err, req) {
        assert.isNull(err);
      },
      'should load profile' : function(err, profile) {
        assert.equal(profile.provider, 'yandex');
        assert.equal(profile.id, '00000000');
        assert.equal(profile.name.familyName, 'User');
        assert.equal(profile.name.givenName, 'Test');
        assert.equal(profile.gender, 'male');
        assert.lengthOf(profile.emails, 1);
        assert.equal(profile.emails[0].value, 'TestUser@yandex.ru');
      },
      'should set raw property' : function(err, profile) {
        assert.isString(profile._raw);
      },
      'should set json property' : function(err, profile) {
        assert.isObject(profile._json);
      },
    },
  },

  'strategy when loading user profile and encountering an error': {
    topic: function() {
      var strategy = new YandexStrategy({
        clientID: 'ABC123',
        clientSecret: 'secret'
      },
      function() {});

      // mock
      strategy._oauth2.get = function(url, accessToken, callback) {
        callback(new Error('something-went-wrong'));
      }

      return strategy;
    },

    'when told to load user profile': {
      topic: function(strategy) {
        var self = this;
        function done(err, profile) {
          self.callback(err, profile);
        }

        process.nextTick(function () {
          strategy.userProfile('access-token', done);
        });
      },

      'should error' : function(err, req) {
        assert.isNotNull(err);
      },
      'should wrap error in InternalOAuthError' : function(err, req) {
        assert.equal(err.constructor.name, 'InternalOAuthError');
      },
      'should not load profile' : function(err, profile) {
        assert.isUndefined(profile);
      },
    },
  },

}).export(module);
