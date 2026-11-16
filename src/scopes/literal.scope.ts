import { isWhitespace } from './utils';

type NumberState = 'sign' | 'zero' | 'int' | 'dot' | 'frac' | 'exp' | 'expSign' | 'expDigits';

const escapes: Record<string, string> = {
  '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t',
};

/** Incremental lexical validation and string decoding; no full-prefix reparsing. */
export class LiteralScope {
  finish = false;
  content = '';
  private kind?: 'string' | 'number' | 'keyword';
  private keyword = '';
  private numberState?: NumberState;
  private escape = false;
  private unicode = 0;
  private unicodeValue = 0;
  private invalid = false;
  private decoded = '';

  isComplete(): boolean {
    if (this.invalid) return false;
    return this.finish || (this.kind === 'number' &&
      ['zero', 'int', 'frac', 'expDigits'].includes(this.numberState!));
  }

  write(letter: string): boolean {
    if (this.finish) throw new Error('Literal already finished');
    if (!this.kind) {
      if (letter === '"') {
        this.kind = 'string'; this.content = letter; return true;
      }
      if ('tfn'.includes(letter)) {
        this.kind = 'keyword';
        this.keyword = letter === 't' ? 'true' : letter === 'f' ? 'false' : 'null';
      } else if (letter === '-' || /[0-9]/.test(letter)) {
        this.kind = 'number';
        this.numberState = letter === '-' ? 'sign' : letter === '0' ? 'zero' : 'int';
        this.content = letter; return true;
      } else return false;
    }
    if (this.kind === 'string') {
      this.content += letter;
      let bad = false;
      if (this.unicode) {
        if (!/[\da-fA-F]/.test(letter)) bad = true;
        else {
          this.unicodeValue = this.unicodeValue * 16 + parseInt(letter, 16);
          if (--this.unicode === 0) this.decoded += String.fromCharCode(this.unicodeValue);
        }
      } else if (this.escape) {
        this.escape = false;
        if (letter === 'u') { this.unicode = 4; this.unicodeValue = 0; }
        else if (Object.hasOwn(escapes, letter)) this.decoded += escapes[letter];
        else bad = true;
      } else if (letter === '\\') {
        this.escape = true;
      } else if (letter === '"') this.finish = true;
      else if (letter.charCodeAt(0) < 32) bad = true;
      else this.decoded += letter;
      if (bad) {
        this.invalid = true;
        // Keep the exact native exception object, type and message. Never log input.
        return this.getOrAssume();
      }
      return true;
    }
    if (this.kind === 'keyword') {
      if (isWhitespace(letter) || ',]}'.includes(letter)) {
        throw new Error(`Incomplete literal: ${this.content}`);
      }
      if (this.keyword[this.content.length] !== letter) return false;
      this.content += letter;
      this.finish = this.content === this.keyword;
      return true;
    }
    if (isWhitespace(letter) || ',]}'.includes(letter)) {
      if (!this.isComplete()) throw new Error(`Incomplete literal: ${this.content}`);
      if (isWhitespace(letter)) { this.finish = true; return true; }
      return false;
    }
    const digit = /[0-9]/.test(letter);
    let next: NumberState | undefined;
    switch (this.numberState) {
      case 'sign': next = letter === '0' ? 'zero' : /[1-9]/.test(letter) ? 'int' : undefined; break;
      case 'zero': case 'int':
        next = this.numberState === 'int' && digit ? 'int' : letter === '.' ? 'dot' : /[eE]/.test(letter) ? 'exp' : undefined; break;
      case 'dot': next = digit ? 'frac' : undefined; break;
      case 'frac': next = digit ? 'frac' : /[eE]/.test(letter) ? 'exp' : undefined; break;
      case 'exp': next = /[+-]/.test(letter) ? 'expSign' : digit ? 'expDigits' : undefined; break;
      case 'expSign': case 'expDigits': next = digit ? 'expDigits' : undefined; break;
    }
    if (!next) return false;
    this.numberState = next; this.content += letter;
    return true;
  }

  getOrAssume(): any {
    if (!this.kind) return null;
    if (this.kind === 'keyword') return this.keyword === 'true' ? true : this.keyword === 'false' ? false : null;
    if (this.kind === 'string') {
      if (this.invalid) return JSON.parse(this.finish ? this.content : this.content + '"');
      return this.decoded;
    }
    if (this.content === '-') return 0;
    return Number(this.content.replace(/[eE][+-]?$/, ''));
  }
}
