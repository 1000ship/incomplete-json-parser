export class JSONStreamParser {
  private buffer: string = "";

  write(chunk: string): void {
    this.buffer += chunk;
  }

  getObjects(): any {
    let buffer = this.buffer.toString();
    const path = [];

    let parsed: any;

    for (let i = 0; i < buffer.length; i++) {
      const char = buffer[i];

      // Skip if the character is a space
      if (path[path.length - 1] !== '"') {
        if (char === "{" || char === "[") {
          path.push(char);
        } else if (char === "}" && path[path.length - 1] === "{") {
          path.pop();
        } else if (char === "]" && path[path.length - 1] === "[") {
          path.pop();
        } else if (char === "n") {
          const remainingChars = buffer.slice(i);
          if (remainingChars.startsWith("null")) {
            i += 3;
          } else if (remainingChars === "nul") {
            i += 2;
            path.push("l");
          } else if (remainingChars === "nu") {
            i += 1;
            path.push("ll");
          } else {
            path.push("ull");
          }
        }
      }

      // Handle escaped characters
      if (char === '"') {
        if (path[path.length - 1] === '"' && buffer[i - 1] !== "\\") {
          path.pop();
        } else if (path[path.length - 1] !== '"') {
          path.push(char);
        }
      }
    }

    // If there's redundant , at the end, remove it
    if (buffer.endsWith(",")) {
      buffer = buffer.slice(0, -1);
    }

    // Add missing parts to the buffer
    if (path.length > 0) {
      const missingParts = path
        .reverse()
        .map((char) => {
          if (char === "{") return "}";
          if (char === "[") return "]";
          if (char === '"') return '"';
          return char;
        })
        .join("");
      buffer += missingParts;
    }

    // Attempt to parse the buffer
    try {
      parsed = JSON.parse(buffer);
      return parsed;
    } catch (error) {
      if (!(error instanceof SyntaxError)) {
        throw error;
      }
    }
  }
}
