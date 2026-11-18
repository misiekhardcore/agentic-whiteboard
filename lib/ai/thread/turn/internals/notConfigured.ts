export // The reason is included because the messages name the setting to fix, and a
// generic "not configured" sends the operator looking at AI_MODEL even when the
// real problem is the approval secret. They never contain a secret value.
const notConfigured = (reason: string) => `The agent is not configured yet. ${reason}`;
