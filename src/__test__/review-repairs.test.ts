import { IncompleteJsonParser } from '../';
import { test, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { resolve } from 'path';

test('tested runtime matrix does not impose a new package Node engine floor', () => {
  const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'));
  expect(Object.prototype.hasOwnProperty.call(pkg, 'engines')).toBe(false);
  const readme = readFileSync(resolve(__dirname, '../../README.md'), 'utf8');
  expect(readme).toContain('24.13.1 and 26.5.0');
  expect(readme).toContain('Older Node versions and browsers have not been verified');
  expect(readme).not.toContain('declared minimum');
});

test('array snapshots avoid per-slot descriptor reflection with object safety positive controls', () => {
  const own = Object.getOwnPropertyDescriptor, define = Object.defineProperty, keys = Object.keys;
  const measure = (n: number) => {
    const p = new IncompleteJsonParser();
    p.write('[' + Array.from({ length: n }, () => '1').join(',') + ',{"__proto__":{"x":-0}}]');
    const counts = { reads: 0, writes: 0, keys: 0, objectWrites: 0 };
    let result: any;
    Object.getOwnPropertyDescriptor = ((o: any, k: PropertyKey) => {
      if (Array.isArray(o)) counts.reads++;
      return own(o, k);
    }) as typeof own;
    Object.defineProperty = ((o: any, k: PropertyKey, d: PropertyDescriptor) => {
      if (Array.isArray(o)) counts.writes++;
      else counts.objectWrites++;
      return define(o, k, d);
    }) as typeof define;
    Object.keys = ((o: any) => { if (Array.isArray(o)) counts.keys++; return keys(o); }) as typeof keys;
    try { result = p.getObjects(); } finally {
      Object.getOwnPropertyDescriptor = own; Object.defineProperty = define; Object.keys = keys;
    }
    expect(result.slice(0, n)).toEqual(Array(n).fill(1));
    expect(Object.getPrototypeOf(result)).toBe(Array.prototype);
    expect(Object.getPrototypeOf(result[n])).toBe(Object.prototype);
    expect(own(result[n], '__proto__')).toEqual({
      value: { x: -0 }, writable: true, enumerable: true, configurable: true,
    });
    expect(Object.is(result[n].__proto__.x, -0)).toBe(true);
    expect(counts.objectWrites).toBeGreaterThanOrEqual(2);
    return counts;
  };
  const small = measure(8), large = measure(128);
  // A causal work metric, not a machine-speed threshold. Both sizes execute real snapshots.
  expect({ small, large }).toEqual({
    small: { reads: 0, writes: 0, keys: 0, objectWrites: 2 },
    large: { reads: 0, writes: 0, keys: 0, objectWrites: 2 },
  });
});

test('array snapshot allocation ignores inherited index setters and array species/iterator hooks', () => {
  const p = new IncompleteJsonParser();
  p.write('[' + Array(40).fill('[{"__proto__":-0},1e309]').join(',') + ']');
  const oldIndex = Object.getOwnPropertyDescriptor(Array.prototype, '17');
  const oldSpecies = Object.getOwnPropertyDescriptor(Array, Symbol.species);
  const oldIterator = Object.getOwnPropertyDescriptor(Array.prototype, Symbol.iterator)!;
  const oldMap = Array.prototype.map;
  let setterCalls = 0, speciesCalls = 0, iteratorCalls = 0, mapCalls = 0;
  let a: any, b: any;
  Object.defineProperty(Array.prototype, '17', { configurable: true, set() { setterCalls++; throw Error('inherited index setter'); } });
  Object.defineProperty(Array, Symbol.species, { configurable: true, get() { speciesCalls++; throw Error('species'); } });
  Array.prototype[Symbol.iterator] = function* (): any { iteratorCalls++; throw Error('iterator'); };
  Array.prototype.map = function (): any { mapCalls++; throw Error('map'); };
  try { a = p.getObjects(); b = p.getObjects(); } finally {
    if (oldIndex) Object.defineProperty(Array.prototype, '17', oldIndex); else delete (Array.prototype as any)[17];
    Object.defineProperty(Array, Symbol.species, oldSpecies!);
    Object.defineProperty(Array.prototype, Symbol.iterator, oldIterator);
    Array.prototype.map = oldMap;
  }
  expect([setterCalls, speciesCalls, iteratorCalls, mapCalls]).toEqual([0, 0, 0, 0]);
  expect(a).toEqual(b);
  a[17][0].__proto__ = 9;
  a[0].push(10);
  expect(Object.is(b[17][0].__proto__, -0)).toBe(true);
  expect(b[0].length).toBe(2);
  expect(Object.is(p.finish()[17][0].__proto__, -0)).toBe(true);
  for (const result of [b, p.getObjects()]) {
    expect(Object.getPrototypeOf(result)).toBe(Array.prototype);
    expect(Object.getPrototypeOf(result[17][0])).toBe(Object.prototype);
    expect(Object.getOwnPropertyDescriptor(result, '17')).toEqual({
      value: result[17], writable: true, enumerable: true, configurable: true,
    });
    expect(result[17][1]).toBe(Infinity);
  }
});
