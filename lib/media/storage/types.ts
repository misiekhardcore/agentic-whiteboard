/** One stored object as the app reads it back. */
export type StoredMediaObject = {
  body: ReadableStream<Uint8Array> | null;
  contentType: string | null;
};

/**
 * The object store, as the media context needs it: put a bounded blob, read it
 * back, drop it. The adapter owns the protocol; nothing above it names a URL.
 */
export type MediaStorage = {
  put(input: { key: string; body: ArrayBuffer; contentType: string }): Promise<void>;
  get(key: string): Promise<StoredMediaObject | null>;
  remove(key: string): Promise<void>;
};
