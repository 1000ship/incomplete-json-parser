const assert = require('node:assert/strict');
const test = require('node:test');
const { IncompleteJsonParser: Parser } = require('incomplete-json-parser');
const pkg = require('incomplete-json-parser/package.json');

test('fresh installed package identity and root API', () => {
  assert.equal(pkg.name, 'incomplete-json-parser');
  assert.equal(pkg.version, '2.0.0');
  assert.equal(pkg.repository.url, 'git+https://github.com/1000ship/incomplete-json-parser.git');
  assert.equal(typeof Parser, 'function');
});
test('complete JSON and incomplete object preview', () => {
  assert.deepEqual(Parser.parse('{"a":{},"b":1e2}'), { a: {}, b: 100 });
  assert.deepEqual(Parser.parse('{"a":"hel'), { a: 'hel' });
});
test('stream completion, strict EOF rejection and continuation', () => {
  const p = new Parser();
  p.write('{"items":[1,');
  assert.equal(p.isComplete(), false);
  assert.throws(() => p.finish(), SyntaxError);
  p.write('2]}');
  assert.equal(p.isComplete(), true);
  assert.deepEqual(p.finish(), { items: [1, 2] });
  p.reset();
  assert.equal(p.isComplete(), false);
});
test('snapshot independence and own __proto__ key', () => {
  const p = new Parser();
  p.write('{"nested":[1],"__proto__":{"safe":true}}');
  const snapshot = p.getObjects();
  snapshot.nested.push(2);
  assert.deepEqual(p.finish().nested, [1]);
  assert.equal(Object.getPrototypeOf(snapshot), Object.prototype);
  assert.equal(Object.hasOwn(snapshot, '__proto__'), true);
  assert.equal({}.safe, undefined);
});
test('split exponent and unicode escape', () => {
  const p = new Parser();
  for (const chunk of ['[1e', '+2,"\\uD83D', '\\uDE00"]']) p.write(chunk);
  assert.equal(p.isComplete(), true);
  assert.deepEqual(p.finish(), [100, '😀']);
});
