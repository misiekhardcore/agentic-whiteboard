/** A canvas setting that is present but unusable, named so a deployer can fix it. */
export class CanvasConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanvasConfigurationError";
  }
}
