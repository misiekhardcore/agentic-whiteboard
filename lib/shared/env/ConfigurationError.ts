/** A deployment setting that is missing or unusable; every context throws this one. */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}
