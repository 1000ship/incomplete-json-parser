import { LiteralScope } from './scopes/literal.scope';
import { isWhitespace } from './scopes/utils';
import { snapshot } from './snapshot';

type Node = LiteralScope | Node[] | { [key: string]: Node | null };
interface Frame {
  value: Node[] | { [key: string]: Node | null };
  array: boolean;
  state: 'key' | 'colon' | 'value' | 'comma';
  count: number;
  key?: string;
  keyToken?: LiteralScope;
}

/** One document, explicit container stack, and at most one active literal. */
export class IncompleteJsonParser {
  private root?: Node;
  private frames: Frame[] = [];
  private active?: { token: LiteralScope; keyOwner?: Frame };
  private rootDone = false;
  private offset = 0;
  private failedAt?: number;

  static parse<T = any>(chunk: string): T {
    const parser = new IncompleteJsonParser();
    parser.write(chunk);
    return parser.getObjects<T>();
  }

  reset(): void {
    this.root = undefined;
    this.frames = [];
    this.active = undefined;
    this.rootDone = false;
    this.offset = 0;
    this.failedAt = undefined;
  }

  write(chunk: string): void {
    for (let i = 0; i < chunk.length; i++) {
      try { this.consume(chunk[i]); }
      catch (error) {
        this.failedAt ??= this.offset;
        throw this.locate(error, this.offset);
      }
      this.offset++;
    }
  }

  private locate(error: unknown, offset: number): unknown {
    if (error instanceof Error) Object.defineProperty(error, 'offset', {
      value: offset, enumerable: true, configurable: true,
    });
    return error;
  }

  private attach(value: Node): void {
    const parent = this.frames[this.frames.length - 1];
    if (!parent) this.root = value;
    else {
      if (parent.array) (parent.value as Node[]).push(value);
      else Object.defineProperty(parent.value, parent.key!, {
        value, enumerable: true, configurable: true, writable: true,
      });
      parent.count++;
      parent.state = 'comma';
    }
  }

  private start(letter: string): void {
    if (letter === '{' || letter === '[') {
      const array = letter === '[';
      const value = array ? [] : Object.create(null);
      this.attach(value);
      this.frames.push({ value, array, count: 0, state: array ? 'value' : 'key' });
    } else {
      const token = new LiteralScope();
      this.attach(token);
      this.active = { token };
      this.feedToken(letter);
    }
  }

  private feedToken(letter: string): boolean {
    const active = this.active!;
    const success = active.token.write(letter);
    if (!success) {
      if (!active.token.isComplete()) throw new Error('Failed to parse the JSON string');
      this.active = undefined;
      if (!this.frames.length) this.rootDone = true;
      return false;
    }
    if (active.token.finish) {
      this.active = undefined;
      if (active.keyOwner) {
        const owner = active.keyOwner;
        owner.key = active.token.getOrAssume();
        owner.state = 'colon';
      } else if (!this.frames.length) this.rootDone = true;
    }
    return true;
  }

  private consume(letter: string): void {
    if (this.active && this.feedToken(letter)) return;
    if (this.rootDone) {
      if (isWhitespace(letter)) return;
      throw new Error('Parser is already finished');
    }
    const frame = this.frames[this.frames.length - 1];
    if (!frame) {
      if (isWhitespace(letter)) return;
      this.start(letter);
      return;
    }
    if (isWhitespace(letter)) return;
    if (frame.state === 'key') {
      if (letter === '}' && frame.count === 0) { this.close(); return; }
      if (letter !== '"') throw new Error(`Expected ", got ${letter}`);
      frame.keyToken = new LiteralScope();
      this.active = { token: frame.keyToken, keyOwner: frame };
      this.feedToken(letter);
    } else if (frame.state === 'colon') {
      if (letter !== ':') throw new Error(`Expected colons, got ${letter}`);
      frame.state = 'value';
    } else if (frame.state === 'value') {
      if (frame.array && letter === ']' && frame.count === 0) { this.close(); return; }
      this.start(letter);
    } else {
      if (letter === (frame.array ? ']' : '}')) { this.close(); return; }
      if (letter !== ',') throw new Error(frame.array
        ? `Expected comma or ], got ${letter}` : `Expected comma or }, got "${letter}"`);
      frame.state = frame.array ? 'value' : 'key';
      frame.key = undefined;
      frame.keyToken = undefined;
    }
  }

  private close(): void {
    this.frames.pop();
    if (!this.frames.length) this.rootDone = true;
  }

  isComplete(): boolean {
    return this.failedAt === undefined && this.root !== undefined && this.frames.length === 0 &&
      (this.rootDone || !!this.active?.token.isComplete());
  }

  finish<T = any>(): T {
    if (!this.isComplete()) throw this.locate(new SyntaxError('Incomplete JSON input'), this.failedAt ?? this.offset);
    const result = this.getObjects<T>();
    this.active = undefined;
    this.rootDone = true;
    return result;
  }

  getObjects<T = any>(): T {
    try { return this.preview(); }
    catch (error) { throw this.locate(error, this.failedAt ?? this.offset); }
  }

  private preview(): any {
    if (this.root === undefined) throw new Error('No input to parse');
    const frame = this.frames[this.frames.length - 1];
    let overlay: { object: object; key: string } | undefined;
    if (frame && !frame.array && frame.keyToken && frame.state !== 'comma') {
      const key = frame.keyToken.getOrAssume();
      if (key.length || frame.keyToken.finish) overlay = { object: frame.value, key };
    }
    return snapshot(this.root, overlay);
  }
}
