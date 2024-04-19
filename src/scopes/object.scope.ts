import { ArrayScope } from "./array.scope";
import { LiteralScope } from "./literal.scope";
import { Scope } from "./scope.interface";
import { isWhitespace } from "./utils";

export class ObjectScope extends Scope {
  object: any = {};
  state: "key" | "colons" | "value" | "comma" = "key";
  keyScope?: LiteralScope;
  valueScope?: Scope;

  write(letter: string): boolean {
    if (this.finish) {
      throw new Error("Object already finished");
      return false;
    }

    // Ignore first [
    if (
      Object.keys(this.object).length === 0 &&
      this.state === "key" &&
      this.keyScope === undefined &&
      this.valueScope === undefined
    ) {
      if (letter === "{") return true;
    }

    if (this.state === "key") {
      if (this.keyScope === undefined) {
        if (isWhitespace(letter)) {
          return true;
        } else if (letter === '"') {
          this.keyScope = new LiteralScope();
          return this.keyScope.write(letter);
        } else {
          throw new Error(`Expected ", got ${letter}`);
          return false;
        }
      } else {
        const success = this.keyScope!.write(letter);
        const key = this.keyScope!.getOrAssume();
        if (typeof key === "string") {
          if (this.keyScope!.finish) {
            this.state = "colons";
          }
          return true;
        } else {
          throw new Error(`Key is not a string: ${key}`);
          return false;
        }
      }
    } else if (this.state === "colons") {
      if (isWhitespace(letter)) {
        return true;
      } else if (letter === ":") {
        this.state = "value";
        this.valueScope = undefined;
        return true;
      } else {
        throw new Error(`Expected colons, got ${letter}`);
        return false;
      }
    } else if (this.state === "value") {
      if (this.valueScope === undefined) {
        if (isWhitespace(letter)) {
          return true;
        } else if (letter === "{") {
          this.valueScope = new ObjectScope();
          return this.valueScope.write(letter);
        } else if (letter === "[") {
          this.valueScope = new ArrayScope();
          return this.valueScope.write(letter);
        } else {
          this.valueScope = new LiteralScope();
          return this.valueScope.write(letter);
        }
      } else {
        const success = this.valueScope!.write(letter);
        if (this.valueScope!.finish) {
          const key = this.keyScope!.getOrAssume();
          this.object[key as string] = this.valueScope!.getOrAssume();
          this.state = "comma";
          return true;
        } else if (success) {
          return true;
        } else {
          if (isWhitespace(letter)) {
            return true;
          } else if (letter === ",") {
            const key = this.keyScope!.getOrAssume();
            this.object[key as string] = this.valueScope!.getOrAssume();
            this.state = "key";
            this.keyScope = undefined;
            this.valueScope = undefined;
            return true;
          } else {
            throw new Error(`Expected comma, got ${letter}`);
          }
        }
      }
    } else if (this.state === "comma") {
      if (isWhitespace(letter)) {
        return true;
      } else if (letter === ",") {
        this.state = "key";
        this.keyScope = undefined;
        this.valueScope = undefined;
        return true;
      } else if (letter === "}") {
        this.finish = true;
        return true;
      } else {
        throw new Error(`Expected comma or }, got "${letter}"`);
      }
    } else {
      throw new Error("Unexpected state");
      return false;
    }
  }

  getOrAssume(): object | undefined {
    const assume = { ...this.object };
    if (this.keyScope || this.valueScope) {
      const key = this.keyScope?.getOrAssume();
      const value = this.valueScope?.getOrAssume();
      if (typeof key === "string" && key.length > 0) {
        if (typeof value !== "undefined") assume[key] = value;
        else assume[key] = null;
      }
    }
    return assume;
  }
}
