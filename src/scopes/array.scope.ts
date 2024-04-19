import { LiteralScope } from "./literal.scope";
import { ObjectScope } from "./object.scope";
import { Scope } from "./scope.interface";
import { isWhitespace } from "./utils";

export class ArrayScope extends Scope {
  array: Scope[] = [];
  state: "value" | "comma" = "value";
  scope?: Scope;

  write(letter: string): boolean {
    if (this.finish) {
      throw new Error("Array already finished");
    }

    // Ignore first [
    if (
      this.array.length === 0 &&
      this.state === "value" &&
      this.scope === undefined
    ) {
      if (letter === "[") {
        return true;
      }
    }

    // Process the letter
    if (this.state === "value") {
      if (this.scope === undefined) {
        if (isWhitespace(letter)) {
          return true;
        } else if (letter === "{") {
          this.scope = new ObjectScope();
          this.array.push(this.scope);
          return this.scope.write(letter);
        } else if (letter === "[") {
          this.scope = new ArrayScope();
          this.array.push(this.scope);
          return this.scope.write(letter);
        } else {
          this.scope = new LiteralScope();
          this.array.push(this.scope);
          const success = this.scope.write(letter);
          return success;
        }
      } else {
        const success = this.scope.write(letter);
        if (success) {
          if (this.scope.finish) this.state = "comma";
          return true;
        } else {
          if (this.scope.finish) {
            this.state = "comma";
            return true;
          } else if (letter === ",") {
            this.scope = undefined;
          } else if ((letter = "]")) {
            this.finish = true;
            return true;
          }
          return true;
        }
      }
    } else if (this.state === "comma") {
      if (isWhitespace(letter)) {
        return true;
      } else if (letter === ",") {
        this.state = "value";
        this.scope = undefined;
        return true;
      } else if (letter === "]") {
        this.finish = true;
        return true;
      } else {
        throw new Error(`Expected comma, got ${letter}`);
      }
    } else {
      throw new Error("Unexpected state");
    }
  }

  getOrAssume() {
    return this.array.map((scope) => scope.getOrAssume());
  }
}
