export class IncompleteJsonParser {
  private buffer: string = "";
  private acculmulator: string = "";
  private pointer: number = 0;
  private path: string[] = [];

  static parse(chunk: string): any {
    const parser = new IncompleteJsonParser();
    parser.write(chunk);
    return parser.getObjects();
  }

  reset(): void {
    this.buffer = "";
    this.acculmulator = "";
    this.pointer = 0;
    this.path = [];
  }

  write(chunk: string): void {
    this.buffer += chunk;
  }

  getObjects(): any {
    let postfix = "";
    this.acculmulator += this.buffer;
    this.buffer = "";

    let i;
    for (i = this.pointer; i < this.acculmulator.length; i++) {
      const char = this.acculmulator[i];

      // Skip if the character is a space
      if (this.path[this.path.length - 1] !== '"') {
        if (char === "{" || char === "[") {
          this.path.push(char);
        } else if (char === "}" && this.path[this.path.length - 1] === "{") {
          this.path.pop();
        } else if (char === "]" && this.path[this.path.length - 1] === "[") {
          this.path.pop();
        } else if (char === "n") {
          const remainingChars = this.acculmulator.slice(i);
          if (remainingChars.startsWith("null")) {
            i += 3;
          } else if (remainingChars === "nul") {
            i += 2;
            postfix = "l";
          } else if (remainingChars === "nu") {
            i += 1;
            postfix = "ll";
          } else {
            postfix = "ull";
          }
        }
      }

      // Handle escaped characters
      if (char === '"') {
        if (
          this.path[this.path.length - 1] === '"' &&
          this.acculmulator[i - 1] !== "\\"
        ) {
          this.path.pop();
        } else if (this.path[this.path.length - 1] !== '"') {
          this.path.push(char);
        }
      }
    }
    this.pointer = i;

    // Post-process the buffer
    let result = this.acculmulator;
    let resultPath = [...this.path];
    let parsed: any;

    // If there's redundant , at the end, remove it
    if (result.endsWith(",")) {
      result = result.slice(0, -1);
    }

    // Complete 'null' values
    if (postfix.length > 0) {
      result += postfix;
    }

    // Add missing parts to the buffer
    if (resultPath.length > 0) {
      const missingParts = resultPath
        .reverse()
        .map((char) => {
          if (char === "{") return "}";
          if (char === "[") return "]";
          if (char === '"') return '"';
          return char;
        })
        .join("");
      result += missingParts;
    }

    // Attempt to parse the buffer
    try {
      parsed = JSON.parse(result);
      return parsed;
    } catch (error) {
      if (!(error instanceof SyntaxError)) {
        throw error;
      }
    }
  }
}
