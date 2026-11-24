/** The variables a deployment started with; a context names only the ones it reads. */
export type Environment = Readonly<Record<string, string | undefined>>;

/** What every context asks of its environment, answered the same way. */
export type EnvironmentReader = {
  /** A setting's trimmed value, or `null` when it is unset or blank. */
  value(name: string): string | null;
  /** An http(s) address without a trailing slash; refuses one reached another way. */
  origin(name: string): string | null;
  /** A ws(s) address without a trailing slash; refuses one a browser cannot open. */
  socketOrigin(name: string): string | null;
  /** A listening port, or the fallback when the setting is unset. */
  port(name: string, fallback: number): number;
};
