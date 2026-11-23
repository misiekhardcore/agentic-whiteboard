/** A deployment's media configuration cannot be used as written. */
export class MediaConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaConfigurationError";
  }
}
