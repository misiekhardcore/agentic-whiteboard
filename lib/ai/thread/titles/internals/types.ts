/**
 * Options forwarded to the provider, keyed by provider name. String values are
 * enough for what naming needs (`reasoningEffort`) and keep this module free of
 * the SDK's wider option types.
 */
export type TitleProviderOptions = Record<string, Record<string, string>>;
