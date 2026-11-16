import { describe, expect, test } from "@jest/globals";
import { IncompleteJsonParser } from "../";

function checkChunkings(json: string): void {
  const expected = JSON.parse(json);
  expect(IncompleteJsonParser.parse(json)).toEqual(expected);
  for (let split = 0; split <= json.length; split++) {
    const parser = new IncompleteJsonParser();
    parser.write(json.slice(0, split));
    if (json.slice(0, split).trim()) parser.getObjects();
    parser.write(json.slice(split));
    expect(parser.getObjects()).toEqual(expected);
  }
  const parser = new IncompleteJsonParser();
  let consumed = "";
  for (const letter of json) {
    consumed += letter;
    parser.write(letter);
    if (consumed.trim()) parser.getObjects();
  }
  expect(parser.getObjects()).toEqual(expected);
}

describe("independent probe regressions (current source)", () => {
  test.each(["0 ", "-0 \t", "-1\r\n", "1.5\n", " \t\r\n-0.25 \t\r\n"])(
    "accepts root-number JSON whitespace in %j across chunks", checkChunkings
  );

  test.each(["0", "null", "{}", "[]", '{"marker":true}', "[1]", '"x"'])(
    "preserves __proto__ own data values %s in completed and partial objects", (value) => {
      const prefix = '{"__proto__":' + value;
      const json = prefix + "}";
      checkChunkings(json);
      checkChunkings('[{"__proto__":' + value + '}]');
      checkChunkings('{"__proto__":1,"__proto__":' + value + '}');
      const parser = new IncompleteJsonParser();
      parser.write(prefix);
      const expected = JSON.parse(json);
      expect(parser.getObjects()).toStrictEqual(expected);
      expect(Object.getOwnPropertyDescriptor(parser.getObjects(), "__proto__")).toEqual({
        value: expected.__proto__, writable: true, enumerable: true, configurable: true,
      });
      expect(Object.getPrototypeOf(parser.getObjects())).toBe(Object.prototype);
      parser.write("}");
      expect(parser.getObjects()).toStrictEqual(expected);
    }
  );

  test("keeps an empty key with zero and a colon-only preview", () => {
    const parser = new IncompleteJsonParser();
    parser.write('{"":');
    expect(parser.getObjects()).toStrictEqual({ "": null });
    parser.write("0");
    expect(parser.getObjects()).toStrictEqual({ "": 0 });
    parser.write("}");
    expect(parser.getObjects()).toStrictEqual({ "": 0 });
  });

  test("preserves the probe's exact escaped-backslash u object preview", () => {
    const value = String.fromCharCode(92) + "u";
    const parser = new IncompleteJsonParser();
    parser.write('{"a":' + JSON.stringify(value).slice(0, -1));
    expect(parser.getObjects()).toStrictEqual({ a: value });
    parser.write('"}');
    expect(parser.getObjects()).toStrictEqual({ a: value });
  });
});

describe("bounded differential and public-API coverage", () => {
  test("matches JSON.parse for a deterministic nested corpus at every boundary", () => {
    let seed = 0x6a09e667;
    const random = () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return seed >>> 0;
    };
    const atoms: unknown[] = [null, true, false, 0, -0, 1.5, -2e-7,
      "", "한글😀", "\\u0", 'a"b\\c\nd', {}, [], { "": 1 }];
    const value = (depth: number): unknown => {
      if (depth === 0 || random() % 3 === 0) return atoms[random() % atoms.length];
      if (random() % 2 === 0) return Array.from({ length: random() % 4 }, () => value(depth - 1));
      const object: Record<string, unknown> = Object.create(null);
      const keys = ["", "a", "__proto__", "constructor", 'quote"', "\\u0"];
      for (let i = 0, length = random() % 4; i < length; i++) {
        object[keys[random() % keys.length]] = value(depth - 1);
      }
      return object;
    };
    for (let i = 0; i < 80; i++) {
      const fixture = value(3);
      checkChunkings(JSON.stringify(fixture));
      checkChunkings(" \n" + JSON.stringify(fixture, null, 2) + "\t\r");
    }
  });

  test.each([
    "[-.1]", "[+1]", "[1..2]", "[--1]", "[-e2]", "[0x10]",
    "[,1]", "[1,,2]", '{,"a":1}', '{"a" 1}', '{"a":}',
    '{"a":1 "b":2}', "[1}", '{"a":1]', "{}[]", "[]{}", "null,",
    '"bad\nline"', String.raw`"bad\x"`, String.raw`"bad\u12"`, String.raw`"bad\u12z"`,
  ])("rejects non-prefix malformed JSON %s", (json) => {
    expect(() => JSON.parse(json)).toThrow();
    expect(() => IncompleteJsonParser.parse(json)).toThrow();
  });

  test("resumes split backslash escapes without changing prior previews", () => {
    const parser = new IncompleteJsonParser();
    parser.write('"a');
    expect(parser.getObjects()).toBe("a");
    parser.write("\\");
    expect(parser.getObjects()).toBe("a");
    parser.write("n");
    expect(parser.getObjects()).toBe("a\n");
    parser.write("\\");
    expect(parser.getObjects()).toBe("a\n");
    parser.write('"');
    expect(parser.getObjects()).toBe('a\n"');
    parser.write('"');
    expect(parser.getObjects()).toBe('a\n"');
  });

  test("resets after completed and incomplete input without retaining state", () => {
    const parser = new IncompleteJsonParser();
    expect(() => parser.getObjects()).toThrow("No input to parse");
    parser.write(" \t\n\r");
    expect(() => parser.getObjects()).toThrow("No input to parse");
    for (const json of ["{}", "1e-", "[{}]", "null", '{"":1}', '"text']) {
      parser.reset();
      parser.write(json);
      expect(parser.getObjects()).toEqual(IncompleteJsonParser.parse(json));
    }
    parser.reset();
    expect(() => parser.getObjects()).toThrow("No input to parse");
    parser.write("1e2 ");
    expect(() => parser.write("3")).toThrow();
  });
});

describe("string escape regressions", () => {
  test.each([
    "", "plain", 'quote: " slash: / backslash: \\\\',
    "line\n tab\t return\r backspace\b formfeed\f", "한글 😀",
    "\\u", "\\u0", "\\u00", "\\u000", "\\u0041", "\\uAB",
    "\\\\u12", "\\\\\\u12", "ends with \\" ,
  ])("matches JSON.parse for escaped string %j across chunks", (value) => {
    for (const json of [JSON.stringify(value), JSON.stringify([value]), JSON.stringify({ [value]: value })]) {
      checkChunkings(json);
    }
  });

  test.each(["u", "u0", "u00", "u000", "u0041", "uAB"])(
    "does not erase an escaped backslash followed by %s in an unfinished string", (suffix) => {
      for (const slashes of [1, 2, 3]) {
        const value = "\\".repeat(slashes) + suffix;
        const parser = new IncompleteJsonParser();
        parser.write(JSON.stringify(value).slice(0, -1));
        expect(parser.getObjects()).toBe(value);
        parser.write('"');
        expect(parser.getObjects()).toBe(value);
      }
    }
  );

  test("suppresses only an actual unfinished unicode escape and resumes it", () => {
    const parser = new IncompleteJsonParser();
    parser.write(String.raw`"before\u`);
    expect(parser.getObjects()).toBe("before");
    parser.write("0");
    expect(parser.getObjects()).toBe("before");
    parser.write("04");
    expect(parser.getObjects()).toBe("before");
    parser.write("1");
    expect(parser.getObjects()).toBe("beforeA");
    parser.write('"');
    expect(parser.getObjects()).toBe("beforeA");
  });

  test.each([
    String.raw`"\u0041\u00e9\uD83D\uDE00"`,
    String.raw`{"\u0061":"\u0000\/\\\""}`,
    String.raw`["\uD800","\uDC00"]`,
  ])("decodes JSON escapes in %s at every boundary", checkChunkings);
});

describe("object key regressions", () => {
  test.each([
    '{"":1}', '{"":{},"next":2}', '{"__proto__":1}',
    '{"__proto__":{"polluted":true},"next":2}',
    '{"constructor":{},"toString":false,"hasOwnProperty":null}',
    '[{"":1},{"__proto__":null}]', '{"a":1,"a":2}',
    '{"\\u0061":1,"a":2}',
  ])("preserves JSON object keys in %s", checkChunkings);

  test.each(["", "__proto__"])("previews and resumes the key %j without changing prototypes", (key) => {
    const parser = new IncompleteJsonParser();
    parser.write("{" + JSON.stringify(key) + ":1");
    const expected = JSON.parse("{" + JSON.stringify(key) + ":1}");
    expect(parser.getObjects()).toStrictEqual(expected);
    expect(Object.hasOwn(parser.getObjects(), key)).toBe(true);
    expect(Object.getPrototypeOf(parser.getObjects())).toBe(Object.prototype);
    parser.write(',"next":2}');
    expect(parser.getObjects()).toStrictEqual({ ...expected, next: 2 });
  });

  test("keeps __proto__ as an own data property", () => {
    const parsed = IncompleteJsonParser.parse('{"__proto__":{"polluted":true}}');
    expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
    expect(Object.hasOwn(parsed, "__proto__")).toBe(true);
    expect(parsed.__proto__).toEqual({ polluted: true });
    expect(parsed.polluted).toBeUndefined();
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  test.each(['{"__proto__":1,}', '{"__proto__":{},}'])(
    "does not mistake %s for an empty object", (json) => {
      expect(() => IncompleteJsonParser.parse(json)).toThrow();
    }
  );
});

describe("literal and delimiter regressions", () => {
  test.each([
    "true", "false", "null", '""', '"hello"',
    " true \n", " false\t", " null\r\n", ' "" ',
    '[true,false,null,"",0,{},[]]',
    '{"t":true,"f":false,"n":null,"s":"","a":[]}',
    '[1,2,3]', '[1 , 2\t, 3\n]',
  ])("matches JSON.parse for %s across chunks", checkChunkings);

  test.each([
    "+", "x", "]", "}", ",", ":", ".", "+1", "NaN", "Infinity",
    "[tru]", "[fals]", "[nul]", "[tr ue]", "[nu ll]",
    '{"a":tru}', '{"a":fals}', '{"a":nul}', '{"a":tr ue}',
    "[true false]", "[null 0]", '["a""b"]', "[{}{}]", "[[][]]",
    '[true,]', '[null,]', '[{},]', '[[],]',
    "truex", "falsefalse", "nulltrue", '""0',
    "\u000b1", "1\u000c", "\u00a0null", "[1\u00a0,2]",
  ])("rejects %s rather than manufacturing a different value", (json) => {
    expect(() => IncompleteJsonParser.parse(json)).toThrow();
    const parser = new IncompleteJsonParser();
    expect(() => { for (const letter of json) parser.write(letter); }).toThrow();
  });

  test.each([
    ["t", "rue", true], ["fa", "lse", false], ["nu", "ll", null],
  ])("still previews and resumes %s", (prefix, suffix, expected) => {
    for (const [open, close, wrap] of [
      ["", "", (value: unknown) => value],
      ["[", "]", (value: unknown) => [value]],
      ['{"a":', "}", (value: unknown) => ({ a: value })],
    ] as const) {
      const parser = new IncompleteJsonParser();
      parser.write(open + prefix);
      expect(parser.getObjects()).toEqual(wrap(expected));
      parser.write(suffix + close);
      expect(parser.getObjects()).toEqual(wrap(expected));
    }
  });

  test("preserves open-container and trailing-comma previews until more input arrives", () => {
    for (const [prefix, suffix, preview, final] of [
      ["[", "1]", [], [1]],
      ["[1,", "2]", [1], [1, 2]],
      ['{"a":1,', '"b":2}', { a: 1 }, { a: 1, b: 2 }],
      ['{"a":', "null}", { a: null }, { a: null }],
    ] as const) {
      const parser = new IncompleteJsonParser();
      parser.write(prefix);
      expect(parser.getObjects()).toEqual(preview);
      parser.write(suffix);
      expect(parser.getObjects()).toEqual(final);
    }
  });
});
