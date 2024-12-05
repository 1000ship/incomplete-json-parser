import { Scope } from "./scope.interface";

export class LiteralScope extends Scope {
  content = "";

  write(letter: string): boolean {
    if (this.finish) throw new Error("Literal already finished");

    this.content += letter;
    const assume = this.getOrAssume();
    if (typeof assume === "undefined") {
      this.content = this.content.slice(0, -1);
      return false;
    }
    if (
      (typeof assume === "string" &&
        this.content.length >= 2 &&
        !this.content.endsWith('\\"') &&
        this.content.endsWith('"')) ||
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
        this.content.length >= 2 && // At least 2 characters ( Starting " and ending " )
        !this.content.endsWith('\\"') && // Not ending with '\\"' (which is escaped " )
        this.content.endsWith('"'); // Ending with "

      if (!isCompletedJsonString) {
        // Delete incomplete unicode escape at the end
        if (/\\u[\da-fA-F]{0,3}$/.test(jsonedString)) {
          const match = /\\u[\da-fA-F]{0,3}$/.exec(jsonedString)!;
          jsonedString = jsonedString.slice(0, match.index);
        }

        // Delete meaningless backslash at the end ( '\' => '' )
        if (jsonedString.endsWith("\\") && !jsonedString.endsWith("\\\\"))
          jsonedString = jsonedString.slice(0, -1);

        jsonedString += '"';
      }

      try {
        return JSON.parse(jsonedString);
      } catch (error) {
        console.warn(`The string cannot be parsed: [${jsonedString}]`);
        throw error;
      }
    }

    // Number
    if (this.content === "-") return 0;
    const numberRegex = /^-?\d+(\.\d*)?$/;
    if (numberRegex.test(this.content)) {
      return parseFloat(this.content);
    }

    // Cannot assume
    return undefined;
  }
}
