import { describe, expect } from "@jest/globals";
import { IncompleteJsonParser } from "../";

describe("IncompleteJsonParser", () => {
  let parser: IncompleteJsonParser;

  beforeEach(() => {
    parser = new IncompleteJsonParser();
  });

  it("should parse complete JSON objects", () => {
    const jsonString = '{"name":"John","age":30,"city":"New York"}';
    parser.write(jsonString);
    expect(parser.getObjects()).toEqual({
      name: "John",
      age: 30,
      city: "New York",
    });
  });

  it("should complete and parse incomplete JSON objects", () => {
    const jsonString = '{"name":"John","age":30,"city":"New York"';
    parser.write(jsonString);
    expect(parser.getObjects()).toEqual({
      name: "John",
      age: 30,
      city: "New York",
    });
  });

  it("should complete and parse incomplete nested JSON objects", () => {
    const jsonString =
      '{"name":"John","age":30,"address":{"street":"123 Main St","city":"New York"';
    parser.write(jsonString);
    expect(parser.getObjects()).toEqual({
      name: "John",
      age: 30,
      address: {
        street: "123 Main St",
        city: "New York",
      },
    });
  });

  it("should complete and parse incomplete JSON arrays", () => {
    const jsonString = '["apple","banana","orange"';
    parser.write(jsonString);
    expect(parser.getObjects()).toEqual(["apple", "banana", "orange"]);
  });

  it("should complete and parse incomplete string values", () => {
    const jsonString = '{"name":"John","message":"Hello, world!';
    parser.write(jsonString);
    expect(parser.getObjects()).toEqual({
      name: "John",
      message: "Hello, world!",
    });
  });

  it("should handle incomplete JSON fed in multiple chunks", () => {
    const chunk1 = '{"name":"John","a';
    const chunk2 = 'ge":30,"city":"New York"}';
    parser.write(chunk1);
    parser.write(chunk2);
    expect(parser.getObjects()).toEqual({
      name: "John",
      age: 30,
      city: "New York",
    });
  });

  it("should handle escaped characters within strings", () => {
    const parser = new IncompleteJsonParser();
    const jsonString = '{"name":"John","message":"Hello, \\"World\\"! [{}]"}';
    parser.write(jsonString);
    expect(parser.getObjects()).toEqual({
      name: "John",
      message: 'Hello, "World"! [{}]',
    });
  });

  it("should handle incomplete null values", () => {
    const parser = new IncompleteJsonParser();
    const jsonString1 = '{"name":"John","age":30,"isStudent":n';
    const jsonString2 = "ull}";
    parser.write(jsonString1);
    expect(parser.getObjects()).toEqual({
      name: "John",
      age: 30,
      isStudent: null,
    });
    parser.write(jsonString2);
    expect(parser.getObjects()).toEqual({
      name: "John",
      age: 30,
      isStudent: null,
    });
  });

  it("should handle null values with different lengths", () => {
    const testCases = ["n", "nu", "nul", "null"];
    testCases.forEach((nullValue) => {
      const parser = new IncompleteJsonParser();
      const jsonString = `{"name":"John","age":30,"isStudent":${nullValue}`;
      parser.write(jsonString);
      expect(parser.getObjects()).toEqual({
        name: "John",
        age: 30,
        isStudent: null,
      });
    });
  });

  it("should handle incomplete nested complicate objects", () => {
    const jsonString =
      '{"name":"John","age":30,"address":{"street":"123 Main St","city":"New York","zip":10001, "alias": ["Dante"';
    parser.write(jsonString);
    expect(parser.getObjects()).toEqual({
      name: "John",
      age: 30,
      address: {
        street: "123 Main St",
        city: "New York",
        zip: 10001,
        alias: ["Dante"],
      },
    });
  });

  it("should remove redundant , at the end of the object", () => {
    const jsonString = '{"name":"John","age":30,"city":"New York",';
    parser.write(jsonString);
    expect(parser.getObjects()).toEqual({
      name: "John",
      age: 30,
      city: "New York",
    });
  });

  it("should handle errored JSON", () => {
    const jsonString = '{"name":"John"{';
    expect(() => parser.write(jsonString)).toThrowError(
      "Expected comma or }, got "
    );
    expect(parser.getObjects()).toEqual({
      name: "John",
    });

    // const jsonString2 = '{"name":"John","age":30,"city":"New York""';
    // parser.write(jsonString2);
    // expect(() => parser.getObjects()).toThrowError(
    //   "Failed to parse the JSON string"
    // );

    const jsonString3 = '{"name":"John","age":30,"city":"New York"}{';
    // parser.write(jsonString3);
    // expect(() => parser.getObjects()).toThrowError(
    //   "Failed to parse the JSON string"
    // );
  });

  it("should return same value if there's no input", () => {
    const jsonString = '{"name":"John","age":30,"city":"New York';
    parser.write(jsonString);
    expect(parser.getObjects()).toEqual({
      name: "John",
      age: 30,
      city: "New York",
    });
    expect(parser.getObjects()).toEqual({
      name: "John",
      age: 30,
      city: "New York",
    });
  });

  it("should handle if the end of letter is ':'", () => {
    const jsonString = '{"name":"John","age":30,"city":';
    parser.write(jsonString);
    expect(parser.getObjects()).toEqual({
      name: "John",
      age: 30,
      city: null,
    });
  });

  it("should handle if the last is just a key", () => {
    const jsonString = '{"name":"John","age":30,"cit';
    parser.write(jsonString);
    expect(parser.getObjects()).toEqual({
      name: "John",
      age: 30,
      cit: null,
    });
    parser.write("y");
    expect(parser.getObjects()).toEqual({
      name: "John",
      age: 30,
      city: null,
    });
    parser.write('"');
    expect(parser.getObjects()).toEqual({
      name: "John",
      age: 30,
      city: null,
    });
    parser.write(":");
    expect(parser.getObjects()).toEqual({
      name: "John",
      age: 30,
      city: null,
    });
  });

  test("'IncompleteJsonParser.parse' works as expected", () => {
    const jsonString = '{"name":"John","age":30,"city":"New York"}';
    expect(IncompleteJsonParser.parse(jsonString)).toEqual({
      name: "John",
      age: 30,
      city: "New York",
    });
  });

  test("'reset' works as expected", () => {
    const jsonString = '{"name":"John","age":30,"city":"New ';
    const parser = new IncompleteJsonParser();
    parser.write(jsonString);
    expect(parser.getObjects()).toEqual({
      name: "John",
      age: 30,
      city: "New ",
    });
    parser.reset();
    expect(() => parser.getObjects()).toThrowError("No input to parse");
  });

  it("should pass the test", () => {
    const jsonString = `
{
  "id": 12345,
  "name": "John Doe",
  "isActive": true,
  "age": 30,
  "email": "john.doe@example.com",
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "country": "USA",
    "location": {
      "lat": 40.7128,
      "lng": -74.0060
    }
  }`.trim();
    const parser = new IncompleteJsonParser();
    parser.write(jsonString);
    expect(parser.getObjects()).toEqual({
      id: 12345,
      name: "John Doe",
      isActive: true,
      age: 30,
      email: "john.doe@example.com",
      address: {
        street: "123 Main St",
        city: "New York",
        state: "NY",
        zipCode: "10001",
        country: "USA",
        location: {
          lat: 40.7128,
          lng: -74.006,
        },
      },
    });
  });
});
