import { Scope } from "./scope.interface";
import {
  endsWithUnescapedQuote,
  endsWithOddBackslashes,
  isWhitespace,
} from "./utils";

const completeNumber = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
const partialNumber = /^-?(?:0|[1-9]\d*)(?:(?:\.\d+)?(?:[eE][+-]?\d*)?|\.)$/;

export class LiteralScope extends Scope {
  content = "";

  write(letter: string): boolean {
    if (this.finish) throw new Error("Literal already finished");

    if (
      this.content !== "" &&
      !this.content.startsWith('"') &&
      (isWhitespace(letter) || ",]}".includes(letter))
    ) {
      if (!completeNumber.test(this.content)) {
        throw new Error(`Incomplete literal: ${this.content}`);
      }
      if (isWhitespace(letter)) {
        this.finish = true;
        return true;
      }
      return false; // The enclosing scope must consume the delimiter.
    }

    this.content += letter;
    const assume = this.getOrAssume();
    if (typeof assume === "undefined") {
      this.content = this.content.slice(0, -1);
      return false;
    }
    if (
      (typeof assume === "string" &&
        this.content.length >= 2 &&
        endsWithUnescapedQuote(this.content)) ||
      (typeof assume === "boolean" && this.content === "true") ||
      (typeof assume === "boolean" && this.content === "false") ||
      (assume === null && this.content === "null")
    ) {
      this.finish = true;
    }
    return true;
  }

  getOrAssume(): boolean | null | string | number | undefined {
    // Null
    if (this.content === "") return null;
    if ("null".startsWith(this.content)) return null;

    // Boolean
    if ("true".startsWith(this.content)) return true;
    if ("false".startsWith(this.content)) return false;

    // String
    if (this.content.startsWith('"')) {
      let jsonedString = this.content;

      const isCompletedJsonString =
        this.content.length >= 2 && endsWithUnescapedQuote(this.content);

      if (!isCompletedJsonString) {
        // Delete incomplete unicode escape at the end
        const incompleteUnicode = /\\u[\da-fA-F]{0,3}$/.exec(jsonedString);
        if (
          incompleteUnicode &&
          endsWithOddBackslashes(jsonedString.slice(0, incompleteUnicode.index + 1))
        ) {
          jsonedString = jsonedString.slice(0, incompleteUnicode.index);
        }

        // Delete meaningless backslash at the end ( '\' => '' )
        if (endsWithOddBackslashes(jsonedString))
          jsonedString = jsonedString.slice(0, -1);

        jsonedString += '"';
      }

      return JSON.parse(jsonedString);
    }

    // Number
    if (this.content === "-") return 0;
    if (partialNumber.test(this.content)) {
      // Preview the mantissa until the exponent has at least one digit.
      return Number(this.content.replace(/[eE][+-]?$/, ""));
    }

    // Cannot assume
    return undefined;
  }
}
