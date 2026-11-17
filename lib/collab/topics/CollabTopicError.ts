export class CollabTopicError extends Error {
  constructor(label: string, value: string) {
    super(
      `Invalid ${label} "${value}". Collaboration ids must be 1-64 characters of letters, digits, hyphens or underscores.`,
    );
    this.name = "CollabTopicError";
  }
}
