import { IncompleteJsonParser } from '../';
import { jest, test, expect } from '@jest/globals';

test('nested snapshots are independent of parser and every earlier result', () => {
  const p = new IncompleteJsonParser();
  p.write('{"a":{"b":[1]},"__proto__":{"x":-0},');
  const first = p.getObjects();
  const second = p.getObjects();
  first.a.b[0] = 99;
  first.__proto__.x = 42;
  expect(second.a.b).toEqual([1]);
  expect(Object.is(second.__proto__.x, -0)).toBe(true);
  p.write('"z":0}');
  expect(p.getObjects().a.b).toEqual([1]);
  expect(Object.is(p.getObjects().__proto__.x, -0)).toBe(true);
  expect(Object.getPrototypeOf(second)).toBe(Object.prototype);
  expect(Object.getOwnPropertyDescriptor(second, '__proto__')).toEqual({
    value: { x: -0 }, enumerable: true, configurable: true, writable: true,
  });
  second.a.b.push(2);
  expect(p.getObjects().a.b).toEqual([1]);
});


test('whole-write long strings and keys avoid repeated native decoding', () => {
  const native = JSON.parse;
  let calls = 0, units = 0;
  const spy = jest.spyOn(JSON, 'parse').mockImplementation((text, reviver) => {
    calls++; units += text.length;
    return native(text, reviver);
  });
  try {
    const n = 2048;
    const p = new IncompleteJsonParser();
    const key = 'k'.repeat(n);
    p.write('{"' + key + '":"' + 'v'.repeat(n) + '"}');
    expect(p.getObjects()[key]).toBe('v'.repeat(n));
    expect(calls).toBeLessThanOrEqual(4);
    expect(units).toBeLessThanOrEqual(4 * (n + 2));
  } finally { spy.mockRestore(); }
});


test('deep writes and previews use bounded JS stack for arrays and objects', () => {
  const depth = 10000;
  for (const [open, close, key] of [['[', ']', 0], ['{"a":', '}', 'a']] as const) {
    const p = new IncompleteJsonParser();
    p.write(open.repeat(depth) + '-0');
    let first = p.getObjects();
    for (let i = 0; i < depth; i++) {
      expect(Object.getPrototypeOf(first)).toBe(key === 0 ? Array.prototype : Object.prototype);
      first = first[key];
    }
    expect(Object.is(first, -0)).toBe(true);
    p.write(close.repeat(depth));
    let final = p.getObjects();
    for (let i = 0; i < depth; i++) final = final[key];
    expect(Object.is(final, -0)).toBe(true);
  }
});


test('strict EOF rejects previews but failed finish allows continuation', () => {
  for (const [prefix, suffix] of [['t','rue'], ['1e+','2'], ['[1,','2]'], ['{"a":','0}'], ['"x','"'], ['-','0'], ['1.','0']]) {
    const p: any = new IncompleteJsonParser();
    p.write(prefix);
    p.getObjects();
    expect(typeof p.isComplete).toBe('function');
    expect(p.isComplete()).toBe(false);
    expect(() => p.finish()).toThrow(SyntaxError);
    p.write(suffix);
    expect(p.isComplete()).toBe(true);
    expect(p.finish()).toEqual(JSON.parse(prefix + suffix));
    p.write(' \n');
    expect(p.isComplete()).toBe(true);
    expect(() => p.write('0')).toThrow();
    p.reset();
    expect(p.isComplete()).toBe(false);
    expect(() => p.finish()).toThrow(SyntaxError);
  }
});

test('strict finish seals a root number but getObjects never does', () => {
  const p: any = new IncompleteJsonParser();
  p.write('1');
  expect(typeof p.isComplete).toBe('function');
  expect(p.isComplete()).toBe(true);
  expect(p.getObjects()).toBe(1);
  p.write('2');
  expect(p.finish()).toBe(12);
  expect(p.finish()).toBe(12);
  expect(() => p.write('3')).toThrow();
  p.reset();
  p.write('['.repeat(10000) + '0' + ']'.repeat(10000));
  expect(p.isComplete()).toBe(true);
  let result = p.finish();
  for (let i = 0; i < 10000; i++) result = result[0];
  expect(result).toBe(0);
});


function failure(action: () => unknown): any {
  try { action(); } catch (e) { return e; }
  throw new Error('expected failure');
}

test('errors expose absolute UTF16 offsets across chunks without consuming suffix', () => {
  const p = new IncompleteJsonParser();
  const initial = ' \n[1';
  p.write(initial);
  expect(failure(() => p.write('x' + 'ignored'.repeat(20))).offset).toBe(initial.length);
  expect(p.isComplete()).toBe(false);
  expect(p.getObjects()).toEqual([1]);
  expect(failure(() => p.finish()).offset).toBe(initial.length);
  p.reset();
  p.write('{"😀":"');
  const prefix = '{"😀":"';
  p.write('ok\\');
  const native = JSON.parse;
  let nativeFailure: any;
  const spy = jest.spyOn(JSON, 'parse').mockImplementation((text, reviver) => {
    try { return native(text, reviver); } catch (e) { nativeFailure = e; throw e; }
  });
  try {
    const e = failure(() => p.write('qignored'));
    expect(e).toBe(nativeFailure);
    expect(e).toBeInstanceOf(SyntaxError);
    expect(e.offset).toBe(prefix.length + 3);
    expect(failure(() => p.getObjects()).offset).toBe(prefix.length + 3);
    expect(p.isComplete()).toBe(false);
  } finally { spy.mockRestore(); }
  p.reset();
  p.write(' \t');
  expect(failure(() => p.finish()).offset).toBe(2);
  p.write('[]');
  expect(p.finish()).toEqual([]);
});


test('string previews reuse incrementally decoded escape state without full-prefix reparsing', () => {
  const native = JSON.parse;
  let calls = 0;
  const spy = jest.spyOn(JSON, 'parse').mockImplementation((text, reviver) => {
    calls++; return native(text, reviver);
  });
  try {
    const p = new IncompleteJsonParser();
    const text = '"' + 'abc'.repeat(512) + String.raw`\uD83D\uDE00\n\\u` + '"';
    for (let i = 0; i < text.length; i++) {
      p.write(text[i]); p.getObjects(); p.getObjects();
    }
    expect(p.finish()).toBe('abc'.repeat(512) + '😀\n\\u');
    expect(calls).toBeLessThanOrEqual(2);
  } finally { spy.mockRestore(); }
});
