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



## API

### `new IncompleteJsonParser()`

Creates a new instance of the `IncompleteJsonParser`.

### `static parse(chunk: string): any`

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

### `getObjects(): any`

Returns the current value, assuming missing endings for supported incomplete input. This can also throw, for example when reading an invalid string left by a failed `write`.

### Usage caveats

- A preview is not proof that the input is complete, valid JSON. If strict validation is required at the end of a stream, validate the complete original input separately (for example with `JSON.parse`).
- Failed writes are not atomic: already consumed input is not rolled back. Catch errors from both `write` and `getObjects`, and call `reset` before starting a new document.
- Treat returned values as read-only. Nested objects or arrays may share references with the parser's state; make your own deep copy before modifying them.
- Deeply nested input uses recursion and may exceed the runtime's stack limit. There is no fixed portable nesting limit; bound input size and nesting externally when needed, and handle parsing errors.



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

Copyright © 2024 [Dante Chun](https://github.com/1000ship).<br />
This project is [MIT](https://github.com/1000ship/react-scroll-motion/blob/master/LICENSE) licensed.
