/** An id that cannot name a change topic, reported by the id rather than guessed at. */
export class ChangesTopicError extends Error {
  constructor(label: string, value: string) {
    super(`A ${label} cannot name a change topic: "${value}".`);
    this.name = "ChangesTopicError";
  }
}
