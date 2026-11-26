/** A projection of content the room owner may return. Never raw CRDT state. */
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
