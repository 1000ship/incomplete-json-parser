import { ArrayScope, LiteralScope, ObjectScope, Scope } from "./scopes";
import { isWhitespace } from "./scopes/utils";

export class IncompleteJsonParser {
  private scope?: Scope;
  private finish: boolean = false;

  static parse(chunk: string): any {
    const parser = new IncompleteJsonParser();
    parser.write(chunk);
    return parser.getObjects();
  }

  reset(): void {
    this.scope = undefined;
    this.finish = false;
  }

  write(chunk: string): void {
    for (let i = 0; i < chunk.length; i++) {
      const letter = chunk[i];

      if(this.finish) {
        if(isWhitespace(letter)) continue;
        throw new Error("Parser is already finished");
      }

      if (this.scope === undefined) {
        if (isWhitespace(letter)) continue;
        else if (letter === "{") this.scope = new ObjectScope();
        else if (letter === "[") this.scope = new ArrayScope();
        else this.scope = new LiteralScope();
        this.scope.write(letter);
      } else {
        const success = this.scope.write(letter);
        if (success) {
          if (this.scope.finish) {
            this.finish = true;
            continue;
          }
        } else {
          throw new Error("Failed to parse the JSON string");
        }
      }
    }
  }

  getObjects(): any {
    if (this.scope) {
      return this.scope.getOrAssume();
    } else {
      throw new Error("No input to parse");
    }
  }
}
