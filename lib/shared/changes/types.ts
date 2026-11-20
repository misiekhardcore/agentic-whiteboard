/**
 * One dataset a successful call changed, named for the interface rather than
 * for a route. A page subscribes to the keys it shows, so a change reaches
 * whoever is looking — including another tab and a call the agent made.
 */
export type Change = {
  /** A key from `CHANGE_KEYS`, or a per-resource key such as `workspace:<id>`. */
  key: string;
  /**
   * Who may be told. `person` is the person who acted; `account` is everyone in
   * the active account, which is the person themselves for a personal account.
   */
  scope: ChangeScope;
};

export type ChangeScope = "person" | "account";

/** The channels a person's changes travel on, as published and as subscribed to. */
export type ChangeChannels = {
  person: string;
  /** The active organization's channel, absent on a personal account. */
  organization: string | null;
};

/**
 * What arrives on a channel. Deliberately keyless to the payload: the browser
 * re-reads the server-rendered data, so a broadcast can never disagree with the
 * database.
 */
export type ChangeEvent = {
  keys: string[];
  /** ISO timestamp, for order and for logs. */
  at: string;
};

/** One broadcast message as the Realtime API takes it. */
export type ChangeMessage = {
  topic: string;
  event: string;
  payload: ChangeEvent;
  private: boolean;
};
