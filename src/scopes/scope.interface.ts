export class Scope {
  finish: boolean = false;

  write(letter: string): boolean {
    return false;
  }

  getOrAssume(): any {
    return undefined;
  }
}
