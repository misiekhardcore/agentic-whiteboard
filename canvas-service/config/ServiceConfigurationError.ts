/** A service setting that is missing or unusable; the process must not start. */
export class ServiceConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceConfigurationError";
  }
}
