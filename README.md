# incomplete-json-parser 

> A JSON parser that can parse incomplete JSON strings.

## Demo

1. **Incomplete JSON** vs **Parse-able JSON**

![demo-small](https://github.com/1000ship/incomplete-json-parser/assets/2270565/a16c9078-a573-40dd-85cb-f2113b03eb56)

2. Application example

<img src="https://github.com/1000ship/incomplete-json-parser/assets/2270565/e91ace5e-1d84-4f32-a3b7-73c1d8022073" alt="application-example" width="300" height="515" />

## What is incomplete-json-parser?

incomplete-json-parser is a TypeScript module that provides a streaming JSON parser. It can handle incomplete or chunked JSON data, making it useful for parsing JSON data that arrives in multiple parts or when dealing with large JSON files.

The parser is designed to be flexible and can handle various scenarios, such as:

- Incomplete JSON objects or arrays
- JSON data split across multiple chunks
- Incomplete string values



## Installation

To install incomplete-json-parser, use the following command:

```bash
npm install incomplete-json-parser
yarn add incomplete-json-parser
```



## Usage

Here's an example of how to use incomplete-json-parser:

```typescript
import { IncompleteJsonParser } from 'incomplete-json-parser';

const parser = new IncompleteJsonParser();

// Write incomplete JSON data to the parser
parser.write('{"name": "John", "age": 30, "city": "New');
parser.write(' York", "hobbies": ["reading", "gaming"');

// Get the parsed JavaScript object
const result = parser.getObjects();
console.log(result);
// Output: { name: 'John', age: 30, city: 'New York', hobbies: ['reading', 'gaming'] }
```

In this example, we create an instance of the `IncompleteJsonParser` and write incomplete JSON data to it using the `write` method. We can write data in multiple chunks, simulating a streaming scenario.

Call `getObjects` to retrieve a preview of the data parsed so far. You can then continue writing more chunks.

```typescript
console.log(parser.isComplete()); // false: the array and object are still open
parser.write(']}');
const complete = parser.finish(); // strict EOF validation, then an independent result
```

## Runtime

Version 2.0.0 is tested on Node.js 24.13.1 and 26.5.0 with TypeScript 5.4.5.
Older Node versions and browsers have not been verified. These are tested runtimes,
not a newly imposed minimum; the package does not declare a Node engine floor.
The ESNext build uses features such as `Object.hasOwn` and `??=`; removing an
engine restriction is not evidence of support for every older runtime.
The package has a CommonJS `main`, with native Node ESM named-import interop.



## API

### `new IncompleteJsonParser()`

Creates a new instance of the `IncompleteJsonParser`.

### `static parse<T = any>(chunk: string): T`

A static method that allows parsing JSON data in a single step. It creates a new instance of `IncompleteJsonParser`, writes the provided `chunk` to it, and returns the parsed JavaScript object.

### Using the `parse` Static Method

```typescript
const json = '{"name": "Alice", "age": 25, "city": "London"';
const result = IncompleteJsonParser.parse(json);
console.log(result);
// Output: { name: 'Alice', age: 25, city: 'London' }
```

### `reset(): void`

Clears the current parsing state so the instance can start a new JSON document. Call this before reusing the parser after an error.

### `write(chunk: string): void`

Parses a chunk incrementally, continuing the current document. Invalid input can throw during this call, before `getObjects` is called.

### `getObjects<T = any>(): T`

Returns the current value, assuming missing endings for supported incomplete input. This can also throw, for example when reading an invalid string left by a failed `write`.

Each result is a deep-independent, mutable snapshot. Mutating nested objects or
arrays cannot change the parser or any earlier/later result. Objects have the
ordinary `Object.prototype`; keys such as `__proto__`, `constructor` and
`prototype` remain own writable/enumerable/configurable data properties. Numbers
use JavaScript/native JSON numeric semantics, including negative zero, rounding
and overflow to Infinity. Results are not frozen or serialized to make copies.

### `isComplete(): boolean`

Returns whether the current document is strictly complete, without sealing it or
materializing a snapshot. Empty/whitespace-only input, open containers/strings,
unfinished keywords and incomplete numbers/exponents return false. A complete
root number can still grow: `write('1')`, `isComplete()` (true), then `write('2')`
produces 12. Neither this query nor `getObjects` signifies EOF.

### `finish<T = any>(): T`

Checks strict EOF and returns a deep-independent snapshot. Throws `SyntaxError`
for incomplete input; a failed EOF check does not prevent writing the missing
suffix. On success the document is sealed: repeat `finish`/`getObjects` calls and
trailing JSON whitespace are allowed, but further non-whitespace input throws.
Use `reset` to begin another document. After a failed `write`, `isComplete` stays
false and `finish` rejects until reset, even if a prefix remains previewable.

### Error locations

Errors from parsing have an additive, read-only `offset` property: zero-based
absolute UTF-16 code-unit index across chunks. EOF errors use the consumed length;
after a write failure they refer to its first failing position. The unconsumed
suffix of the failed chunk does not advance that cursor. A supplementary Unicode
character occupies two UTF-16 units. Native string `SyntaxError` objects are
re-thrown unchanged in identity/type/message, with this location added, not wrapped.
Native error messages remain runtime-dependent and can themselves contain input;
the library does not automatically log input or errors. Treat exception messages
as potentially sensitive in your application's own logs.

```typescript
const parser = new IncompleteJsonParser();
parser.write('[1');
try { parser.write('x ignored'); }
catch (error) { console.log((error as { offset: number }).offset); } // 2
parser.reset();
```

### Optional result types

`JsonValue`, `JsonPrimitive`, `JsonObject`, `JsonArray` and the structural
`JsonParseError` interface are exported as TypeScript types. Existing callers keep
the `any` default. Opt in with `parser.getObjects<JsonValue>()`,
`parser.finish<JsonValue>()` or `IncompleteJsonParser.parse<JsonValue>(chunk)`.
A generic is only a caller's type annotation, **not** runtime schema validation.
Narrow/validate unknown application shapes yourself before trusting their fields.

### Usage caveats

- A preview is not proof that the input is complete, valid JSON. Call `finish` at actual stream EOF if strict completion is required. Do not use assumed previews alone for authorization or other security decisions.
- Failed writes are not atomic: already consumed input is not rolled back. Catch errors from both `write` and `getObjects`, and call `reset` before starting a new document.
- Parser writes and snapshot traversal use explicit stacks, not one JavaScript call per nesting level. Finite checks cover 10,000 nested arrays/objects; this is not an unlimited-depth/size guarantee. Input state, tokens and independent snapshots consume memory. Bound input size, depth, time and preview cadence in your integration and handle exceptions.

### Performance and resource tradeoffs

Strings and keys validate/decode incrementally, including split Unicode escapes,
without native parsing of the entire accumulated token after every character.
Incomplete escape fragments are omitted from previews until complete. Malformed
escapes/control characters still fail immediately during `write`, not at EOF.
Container attachment is iterative; every requested object/array snapshot still
traverses/copies its full current output. Asking for a preview after every character
can therefore have quadratic total output work and can be slower than 1.1.6 for
container-heavy inputs because snapshots are now deeply independent. Preview at
your UI's render cadence when possible. No universal throughput/memory bound or
all-input speedup is promised.

### 2.0.0 release notes and migration

This release uses a new major version because previously published internal
modules and helpers are removed or changed. Applications using only the
documented package-root API can keep their existing imports and calls.

- Incremental string/key decoding avoids repeated whole-token native parsing.
- Deep-independent mutable snapshots and iterative container traversal handle
  the tested 10,000-level nesting cases without recursive JavaScript stack growth.
- Optional `isComplete()` and strict `finish()` distinguish previews from EOF.
- Parsing errors gain absolute UTF-16 `offset` locations; the library does not
  automatically log raw input. Native error messages can still contain input.
- Optional JSON result types preserve the existing `any` defaults. Documentation
  and the local MIT license are included.

Deep snapshots copy their current output. Per-character previews can still be
slower for container-heavy inputs than 1.1.6; there is no all-input speedup or
unlimited-resource guarantee. See the performance and resource notes above.

The documented package-root API remains available, with optional completion,
location and typing additions. Compared with published 1.1.6, the undocumented
`dist/scopes/index.js`, `array.scope.js`, `object.scope.js` and
`scope.interface.js` modules are removed. `dist/scopes/utils.js` no longer exports
`endsWithUnescapedQuote` or `endsWithOddBackslashes`, and `LiteralScope` no longer
inherits from the former `Scope` class. Code importing these internals may need
changes even though they were not documented public entry points. Migrate imports
of those internals to `IncompleteJsonParser` from `incomplete-json-parser`;
internal scope subclasses are not a supported extension interface. Deep imports
that remain in the archive are not a stability guarantee for future versions.



## Examples

Here are a few more examples demonstrating the capabilities of incomplete-json-parser:

### Handling Incomplete JSON Objects

```typescript
const parser = new IncompleteJsonParser();

parser.write('{"name": "Alice", "age": 25, "city": "London"');
const result = parser.getObjects();
console.log(result);
// Output: { name: 'Alice', age: 25, city: 'London' }
```

### Handling Incomplete JSON Arrays

```typescript
const parser = new IncompleteJsonParser();

parser.write('["apple", "banana", "orange"');
const result = parser.getObjects();
console.log(result);
// Output: ['apple', 'banana', 'orange']
```

### Handling Incomplete String Values

```typescript
const parser = new IncompleteJsonParser();

parser.write('{"message": "Hello, world!');
const result = parser.getObjects();
console.log(result);
// Output: { message: 'Hello, world!' }
```

### Streaming Numbers

Numbers support JSON exponent notation (`e` or `E`, with an optional `+` or `-`).
An unfinished exponent previews its mantissa without discarding the exponent:

```typescript
const parser = new IncompleteJsonParser();
parser.write('[1.5E-');
console.log(parser.getObjects()); // [1.5]
parser.write('2, {}]');
console.log(parser.getObjects()); // [0.015, {}]
```

Incomplete prefixes such as `-`, `1.`, `1e`, and `1e+` can still be continued.
Reading a preview does not finish the parser. A delimiter may terminate only a
complete literal; a preview does not terminate an unfinished stream. Malformed
tokens such as `[1x2]`, `[1 2]`, and `[1e+]` throw instead of silently dropping
characters. Open containers and
unfinished trailing commas (for example `[1,`) still preview their values,
but a closing delimiter cannot turn a trailing comma into valid JSON.

### Handling `null` Values with Different Lengths

```typescript
const parser = new IncompleteJsonParser();

parser.write('{"value": n');
const result1 = parser.getObjects();
console.log(result1);
// Output: { value: null }

parser.write('u');
const result2 = parser.getObjects();
console.log(result2);
// Output: { value: null }
```



## Author

👤 **Dante Chun**

* Website: https://dante.company
* Github: [@1000ship](https://github.com/1000ship)



## 🤝 Contributing

Contributions, issues and feature requests are welcome!<br />Feel free to check [issues page](https://github.com/1000ship/incomplete-json-parser/issues). 



## Show your support

Give a ⭐️ if this project helped you!



## 📝 License

Copyright © [Dante Chun](https://github.com/1000ship).<br />
This project is [MIT](./LICENSE) licensed.
