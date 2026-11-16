/** JSON-shaped data; number retains native JSON.parse overflow/-0 semantics. */
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export interface JsonObject { [key: string]: JsonValue }
export interface JsonArray extends Array<JsonValue> {}

/** Additive location on parser errors, not a new exception class. */
export interface JsonParseError extends Error {
  readonly offset: number;
}
