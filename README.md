# json-stream-parser

> A streaming JSON parser that can handle incomplete or chunked JSON data.

## What is json-stream-parser?

json-stream-parser is a TypeScript module that provides a streaming JSON parser. It can handle incomplete or chunked JSON data, making it useful for parsing JSON data that arrives in multiple parts or when dealing with large JSON files.

The parser is designed to be flexible and can handle various scenarios, such as:

- Incomplete JSON objects or arrays
- JSON data split across multiple chunks
- Incomplete string values

## Installation

To install json-stream-parser, use the following command:

```bash
npm install json-stream-parser
yarn add json-stream-parser
```

## Usage

Here's an example of how to use json-stream-parser:

```typescript
import { JSONStreamParser } from 'json-stream-parser';

const parser = new JSONStreamParser();

// Write incomplete JSON data to the parser
parser.write('{"name": "John", "age": 30, "city": "New');
parser.write(' York", "hobbies": ["reading", "gaming"');

// Get the parsed JavaScript object
const result = parser.getObjects();
console.log(result);
// Output: { name: 'John', age: 30, city: 'New York', hobbies: ['reading', 'gaming'] }
```

In this example, we create an instance of the `JSONStreamParser` and write incomplete JSON data to it using the `write` method. We can write data in multiple chunks, simulating a streaming scenario.

Once we have written all the necessary data, we call the `getObjects` method to parse the accumulated JSON data and retrieve the resulting JavaScript object.

## API

### `new JSONStreamParser()`

Creates a new instance of the `JSONStreamParser`.

### `write(chunk: string): void`

Writes a chunk of JSON data to the parser's internal buffer.

### `getObjects(): any`

Parses the accumulated JSON data and returns the parsed JavaScript object.

## Examples

Here are a few more examples demonstrating the capabilities of json-stream-parser:

### Handling Incomplete JSON Objects

```typescript
const parser = new JSONStreamParser();

parser.write('{"name": "Alice", "age": 25, "city": "London"');
const result = parser.getObjects();
console.log(result);
// Output: { name: 'Alice', age: 25, city: 'London' }
```

### Handling Incomplete JSON Arrays

```typescript
const parser = new JSONStreamParser();

parser.write('["apple", "banana", "orange"');
const result = parser.getObjects();
console.log(result);
// Output: ['apple', 'banana', 'orange']
```

### Handling Incomplete String Values

```typescript
const parser = new JSONStreamParser();

parser.write('{"message": "Hello, world!');
const result = parser.getObjects();
console.log(result);
// Output: { message: 'Hello, world!' }
```

### Handling `null` Values with Different Lengths

```typescript
const parser = new JSONStreamParser();

parser.write('{"value": n');
const result1 = parser.getObjects();
console.log(result1);
// Output: { value: null }

parser.write('{"value": nu');
const result2 = parser.getObjects();
console.log(result2);
// Output: { value: null }
```

## Author

👤 **Dante Chun**

* Website: https://dante.company
* Github: [@1000ship](https://github.com/1000ship)

## 🤝 Contributing

Contributions, issues and feature requests are welcome!<br />Feel free to check [issues page](https://github.com/1000ship/json-stream-parser/issues). 

## Show your support

Give a ⭐️ if this project helped you!

## 📝 License

Copyright © 2024 [Dante Chun](https://github.com/1000ship).<br />
This project is [MIT](https://github.com/1000ship/react-scroll-motion/blob/master/LICENSE) licensed.