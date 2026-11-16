import { LiteralScope } from './scopes/literal.scope';

// Array.from on a non-iterable array-like creates ordinary own data slots, without
// consulting source iterators/constructors/species or inherited indexed setters.
const arrayFrom = Array.from;

/** Materialize parser-owned dense data nodes without recursion or serialization. */
export function snapshot(value: any, overlay?: { object: object; key: string }): any {
  const materialize = (node: any): any => node instanceof LiteralScope ? node.getOrAssume() : node;
  value = materialize(value);
  if (value === null || typeof value !== 'object') return value;
  type Pending = { source: any; target: any; next: Pending | undefined };
  let pending: Pending | undefined;
  const allocate = (source: any): any => {
    const target = !Array.isArray(source) ? {}
      // Literal allocation also creates own data slots. Avoid callback/builtin
      // overhead for the short arrays common in deep and nested documents.
      : source.length === 0 ? []
      : source.length === 1 ? [source[0]]
      : source.length === 2 ? [source[0], source[1]]
      : arrayFrom({ length: source.length }, (_, i) => source[i]);
    pending = { source, target, next: pending };
    return target;
  };
  const result = allocate(value);
  const copy = (node: any): any => {
    const child = materialize(node);
    return child !== null && typeof child === 'object' ? allocate(child) : child;
  };
  while (pending) {
    const { source, target } = pending;
    pending = pending.next;
    if (Array.isArray(source)) {
      // Parser arrays are dense, private own-data nodes. These assignments update
      // slots already created above; they cannot invoke prototype setters.
      for (let i = 0; i < source.length; i++) target[i] = copy(source[i]);
    } else {
      const keys = Object.keys(source);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        Object.defineProperty(target, key, {
          value: copy(source[key]), enumerable: true, configurable: true, writable: true,
        });
      }
    }
    if (overlay && source === overlay.object) Object.defineProperty(target, overlay.key, {
      value: null, enumerable: true, configurable: true, writable: true,
    });
  }
  return result;
}
