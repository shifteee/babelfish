'use strict';


var Assert = require('assert');
var Parser = require('../lib/babelfish/parser');
var Helper = require('./helper');

var MACROS_REGEXP = Parser.MACROS_REGEXP;

require('vows').describe('BabelFish.Parser').addBatch({
  'Parsing simple string': {
    topic: function () {
      return [
        Parser.parse('Просто строка'),
        Parser.parse('    #{ '),
        Parser.parse('    }} '),
        Parser.parse('  }\t\n #{'),
      ];
    },
    'results in text node': function (result) {
      Assert.deepEqual(result, [
        [ { type: 'text', value: 'Просто строка' } ],
        [ { type: 'text', value: '    #{ ' } ],
        [ { type: 'text', value: '    }} ' } ],
        [ { type: 'text', value: '  }\t\n #{' } ],
      ]);
    }
  },
  'Parsing string with variable': {
    topic: function () {
      return Parser.parse('Complex string, with variable foo.bar.baz #{foo.bar.baz}');
    },
    'results in anchor node': function (result) {
      Assert.deepEqual(result, [
        { value: 'Complex string, with variable foo.bar.baz ', type: 'text' },
        { anchor: 'foo.bar.baz', type: 'variable' }
      ]);
    }
  },
  'Parsing strings with quirky interpolation': {
    topic: function () {
      return [
        Parser.parse('#{}'),
        Parser.parse('#{1}'),
        Parser.parse('#{  }'),
        Parser.parse(' foo bar. #{. (.) . (.).} bazzz.%{}$_'),
      ];
    },
    'results in passing string verbatim': function (result) {
      Assert.deepEqual(result, [
        [{value: '#{}', type: 'text'}],
        [{ value: '#{1}', type: 'text' }],
        [{ value: '#{  }', type: 'text' }],
        [{ value: ' foo bar. #{. (.) . (.).} bazzz.%{}$_', type: 'text' }],
      ]);
    }
  },
  'Parsing string with plurals': {
    'quirky but valid variable': {
      topic: function () {
        return [
          Parser.parse('%{a|b|c}:foo_bar$baz.fu.1.bar.baz'),
          Parser.parse('%{a|b|c}:___[0][1][2].a'),
          Parser.parse('%{a|b|c}:...'),
        ];
      },
      'results in sane behavior': function (result) {
        Assert.deepEqual(result, [
          [ { forms: [ 'a', 'b', 'c' ], anchor: 'foo_bar$baz.fu.1.bar.baz', type: 'plural' } ],
          [ { forms: [ 'a', 'b', 'c' ], anchor: '___', type: 'plural' }, { value: '[0][1][2].a', type: 'text'} ],
          [ { value: '%{a|b|c}:...', type: 'text' } ],
        ]);
      }
    },
    'empty plural': {
      topic: function () {
        return Parser.parse('More complex string, with plurals foo_bar$baz.fu %{}:foo_bar$baz.fu');
      },
      'results in passing string intact': function (result) {
        Assert.deepEqual(result, [ { value: 'More complex string, with plurals foo_bar$baz.fu %{}:foo_bar$baz.fu', type: 'text' } ]);
      }
    },
    'only singular form given': {
      topic: function () {
        return Parser.parse('%{fou}:foo_bar$baz.fu');
      },
      'one form got': function (result) {
        Assert.deepEqual(result, [ { forms: [ 'fou' ], anchor: 'foo_bar$baz.fu', type: 'plural' } ]);
      }
    },
    'two forms given': {
      topic: function () {
        return Parser.parse('%{fou  |fous  }:x');
      },
      'two forms got': function (result) {
        Assert.deepEqual(result, [ { forms: [ 'fou  ', 'fous  ' ], anchor: 'x', type: 'plural' } ]);
      }
    },
    'three forms given': {
      topic: function () {
        return Parser.parse('%{fou  |fous  |  multifous  }:x');
      },
      'three forms got': function (result) {
        Assert.deepEqual(result, [ { forms: [ 'fou  ', 'fous  ', '  multifous  ' ], anchor: 'x', type: 'plural' } ]);
      }
    },
    'four forms given': {
      topic: function () {
        return Parser.parse('%{fou  |fous  |  multifous  |}:x');
      },
      'four forms got': function (result) {
        Assert.deepEqual(result, [ { forms: [ 'fou  ', 'fous  ', '  multifous  ', '' ], anchor: 'x', type: 'plural' } ]);
      }
    }
  },
  'Escaping': {
    'of both interpolation and pluralization': {
      topic: function () {
        return Parser.parse(' dfgjhlh gsdf \\#{a...b.c} \\%{lorem ipsum}:abc asjkl sdfc');
      },
      'does not produce anchors': function (result) {
        Assert.deepEqual(result, [ { value: ' dfgjhlh gsdf #{a...b.c} %{lorem ipsum}:abc asjkl sdfc', type: 'text' } ]);
      }
    },
    'of word forms in pluralization': {
      topic: function () {
        return Parser.parse(' dfgjhlh gsdf \\#{a...b.c} %{l\\}orem |\\}ipsum}:abc asjkl sdfc');
      },
      'is unescaped': function (result) {
        Assert.deepEqual(result, [
          { value: ' dfgjhlh gsdf #{a...b.c} ', type: 'text' },
          { forms: ['l}orem ','}ipsum'], anchor: 'abc', type: 'plural' },
          { value: 'asjkl sdfc', type: 'text' },
          { value: ' asjkl sdfc', type: 'text' }
        ]);
      }
    },
  },
  'MACROS_REGEXP': {
    'allows escaped argument separator as part of argument': {
      topic: function () {
        return [
          ' texte1 %{a|b|c}:x  texte2 '.match(MACROS_REGEXP).slice(0, 5),
          ' texte1 %{a\\||b \\||\\|  c}:x  texte2 '.match(MACROS_REGEXP).slice(0, 5),
          ' texte1 %{\u007d|1|2}:x  texte2 '.match(MACROS_REGEXP).slice(0, 5),
        ];
      },
      'good': function (result) {
        Assert.isArray(result[0]);
        Assert.deepEqual(result[0], [' texte1 %{a|b|c}:x', ' texte1 ', undefined, 'a|b|c', 'x']);
      },
      'bad': function (result) {
        Assert.isArray(result[1]);
        Assert.deepEqual(result[1], [' texte1 %{a\\||b \\||\\|  c}:x', ' texte1 ', undefined, 'a\\||b \\||\\|  c', 'x']);
      },
      'ugly': function (result) {
        Assert.isArray(result[2]);
        Assert.deepEqual(result[2], [' texte1 %{\u007d|1|2}:x', ' texte1 ', undefined, '\u007d|1|2', 'x']);
      },
    },
    'allows escaped macros close char as part of argument': {
      topic: function () {
        return [
          ' pretexte1 %{ |c\\}}:x soustexte2 '.match(MACROS_REGEXP).slice(0, 5),
          ' text1 %{ \\||||c\\}:\\}:x text2 '.match(MACROS_REGEXP),
          ' text1 %{ \\||||c\\}:\\}}:x text2 '.match(MACROS_REGEXP).slice(0, 5),
        ];
      },
      'for pluralization': function (result) {
        Assert.isArray(result[0]);
        Assert.deepEqual(result[0], [' pretexte1 %{ |c\\}}:x', ' pretexte1 ', undefined, ' |c\\}', 'x']);
      },
      'for pluralization, if it is done properly': function (result) {
        Assert.isNull(result[1]);
      },
      'for pluralization, plus spiky backslashes': function (result) {
        Assert.isArray(result[2]);
        Assert.deepEqual(result[2], [' text1 %{ \\||||c\\}:\\}}:x', ' text1 ', undefined, ' \\||||c\\}:\\}', 'x']);
      },
    },
    'disallows escaped macros close char in interpolation': {
      topic: function () {
        return [
          ' texte1 #{c\\}} texte2 '.match(MACROS_REGEXP).slice(0, 3),
          ' texte1 #{c\\} texte2 '.match(MACROS_REGEXP).slice(0, 3),
        ];
      },
      'properly closed': function (result) {
        Assert.isArray(result[0]);
        Assert.deepEqual(result[0], [' texte1 #{c\\}}', ' texte1 ', 'c\\}']);
      },
      'improperly closed': function (result) {
        Assert.isArray(result[1]);
        Assert.deepEqual(result[2], [' texte1 #{c\\}', ' texte1 ', 'c\\']);
      },
    },
  },
  'Variable parsing': {
    'variables extracted': {
      topic: function () {
        return [
          matchVar('a'),
          matchVar('a.a'),
          matchVar('a.a.aaa.aaaa'),
          matchVar('a_$.$$$a.____aa_a.aaaa._.$'),
        ];
      },
      'ok': function (result) {
        var i, r = true;
        for (i = 0; i < result.length; i += 1) {
          r = r && result[i];
        }
        Assert.isTrue(r);
      },
    },
    'false positives': {
      topic: function () {
        return [
          matchVar('ф'),
          matchVar('a..a'),
          matchVar('a.a.'),
          matchVar('.a'),
          matchVar('.'),
          matchVar('....'),
          matchVar('Jožin z bažin'),
        ];
      },
      'absent': function (result) {
        var i, r = false;
        for (i = 0; i < result.length; i += 1) {
          r = r || result[i];
        }
        console.log(result);
        Assert.isFalse(r);
      },
    },
  },
}).export(module);

var REVAR = /([_$a-z](?:[_$a-z0-9.]*?[_$a-z0-9])?)/;

function matchVar(str) {
  return str.match(REVAR) !== null;
}
