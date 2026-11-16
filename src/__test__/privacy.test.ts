import { describe, expect, jest, test } from "@jest/globals";
import { IncompleteJsonParser } from "../";

function catchError(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw new Error("Expected malformed escape to throw");
}

describe("malformed string privacy", () => {
  test.each([
    ["root string", '"'],
    ["object value", '{"message":"'],
    ["object key", '{"'],
    ["nested array value", '{"items":["'],
  ])("does not log %s errors through parse, write or getObjects", (_label, prefix) => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    const nativeParse = JSON.parse;
    const nativeErrors: unknown[] = [];
    // Observe real native failures so callers must receive the same error object.
    const parse = jest.spyOn(JSON, "parse").mockImplementation((text, reviver) => {
      try {
        return nativeParse(text, reviver);
      } catch (failure) {
        nativeErrors.push(failure);
        throw failure;
      }
    });

    try {
      const malformed = prefix + String.raw`SYNTHETIC_PRIVATE_SENTINEL\q`;
      const expectNativeFailure = (action: () => unknown): void => {
        const before = nativeErrors.length;
        const failure = catchError(action);
        expect(nativeErrors).toHaveLength(before + 1);
        expect(failure).toBeInstanceOf(SyntaxError);
        expect(failure).toBe(nativeErrors[before]);
      };

      expectNativeFailure(() => IncompleteJsonParser.parse(malformed));
      const parser = new IncompleteJsonParser();
      expectNativeFailure(() => parser.write(malformed));
      // Failed writes retain consumed input; reading that state still rejects it.
      expectNativeFailure(() => parser.getObjects());
      parser.reset();
      parser.write('{"ok":');
      expect(parser.getObjects()).toStrictEqual({ ok: null });
      parser.write('true}');
      expect(parser.getObjects()).toStrictEqual({ ok: true });

      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
      expect(log).not.toHaveBeenCalled();
    } finally {
      parse.mockRestore();
      warn.mockRestore();
      error.mockRestore();
      log.mockRestore();
    }
  });
});
