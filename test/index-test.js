var vows = require('vows');
var assert = require('assert');
var util = require('util');
var yandex = require('passport-yandex');


vows.describe('passport-yandex').addBatch({
  
  'module': {
    'should report a version': function (x) {
      assert.isString(yandex.version);
    },
  },
  
}).export(module);
