import { describe, expect, test } from "@jest/globals";
import { IncompleteJsonParser } from "../";

function expectAllChunkings(json: string): void {
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
    parser.write(letter);
    consumed += letter;
    if (consumed.trim()) parser.getObjects();
  }
  expect(parser.getObjects()).toEqual(expected);
}

describe("issue #6: exponent numbers", () => {
  test.each([
    "[1e2]", "[1.5E-2]", "[0e1]", '{"x":2e3}',
    "1e2", "-0E+1", "-12.5e-2", "0.25E+02",
    " [1e2 , -1.5E-2\n,0e1, 2E+3] \t",
    '{"x":2e3 \n,"y":-0.25E+2\t}',
    '[1e2,{"n":-1E-2},[],true,null,"1e2"]',
    "0", "-0", "10", "1.5", "-0.125", "1e02", "1e309",
  ])("parses %s at every chunk boundary", expectAllChunkings);

  test.each(["1e", "1e+", "1e-", "1.5E-", "-2E+"])(
    "preserves the unfinished exponent %s when resuming", (prefix) => {
      for (const [open, close, wrap] of [
        ["", "", (n: number) => n],
        ["[", "]", (n: number) => [n]],
        ['{"n":', "}", (n: number) => ({ n })],
      ] as const) {
        const parser = new IncompleteJsonParser();
        parser.write(open + prefix);
        const mantissa = Number(prefix.replace(/[eE][+-]?$/, ""));
        expect(parser.getObjects()).toEqual(wrap(mantissa));
        expect(parser.getObjects()).toEqual(wrap(mantissa));
        parser.write("2" + close);
        expect(parser.getObjects()).toEqual(wrap(Number(prefix + "2")));
      }
    }
  );

  test.each([
    "[1x2]", "[1e+z2]", "[1e2e3]", "[1e--2]", "[1e+-2]",
    "[1.e2]", "[01]", "[-01]", "[1e]", "[1e+]", "[1e-]",
    "[1.]", "[-]", "[1 2]", "[1e 2]", "[1e2,]",
    '{"x":1e}', '{"x":1e+}', '{"x":1e-}', '{"x":1.}',
    '{"x":1e2 3}', "1e2x", "1e2 3", "01", "1.e2",
  ])("rejects malformed number input %s instead of dropping characters", (json) => {
    expect(() => IncompleteJsonParser.parse(json)).toThrow();
    const parser = new IncompleteJsonParser();
    expect(() => { for (const letter of json) parser.write(letter); }).toThrow();
  });

  test.each(["-", "1.", "-0."])("retains the existing partial preview for %s", (prefix) => {
    const parser = new IncompleteJsonParser();
    parser.write("[" + prefix);
    expect(parser.getObjects()).toEqual([prefix === "-" ? 0 : Number(prefix)]);
    parser.write("5]");
    expect(parser.getObjects()).toEqual([Number(prefix + "5")]);
  });
});

describe("issue #6: empty objects", () => {
  test.each([
    "{}", "[{}]", '{"a":{}}', " { \n\t } \r\n",
    '[{}, {"a":{}}, [], {"b":[{},{}]}]',
    '{"a":{},"b":1,"c":{"d":{}}}',
  ])("parses %s at every chunk boundary", expectAllChunkings);

  test("previews an empty nested object before resuming", () => {
    const parser = new IncompleteJsonParser();
    parser.write('{"a":');
    expect(parser.getObjects()).toEqual({ a: null });
    parser.write("{");
    expect(parser.getObjects()).toEqual({ a: {} });
    parser.write("}");
    expect(parser.getObjects()).toEqual({ a: {} });
    parser.write(',"b":{}}');
    expect(parser.getObjects()).toEqual({ a: {}, b: {} });
  });

  test.each(['{"a":1,}', '{"a":{},}', "{{}}", "{}x"])(
    "does not accept malformed object %s", (json) => {
      expect(() => IncompleteJsonParser.parse(json)).toThrow();
    }
  );
});
