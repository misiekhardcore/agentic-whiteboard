import { describe, expect, it } from "vitest";

import { changeKeysHeaderValue, readChangeKeys } from "./headers";

describe("change keys header", () => {
  it("names each changed key once", () => {
    expect(
      changeKeysHeaderValue([
        { key: "conversations", scope: "person" },
        { key: "account", scope: "person" },
        { key: "conversations", scope: "account" },
      ]),
    ).toBe("conversations, account");
  });

  it("reads its own header back", () => {
    const header = changeKeysHeaderValue([{ key: "conversations", scope: "person" }]);

    expect(readChangeKeys(header)).toEqual(["conversations"]);
  });

  it("reads nothing from a missing or empty header", () => {
    expect(readChangeKeys(null)).toEqual([]);
    expect(readChangeKeys("")).toEqual([]);
    expect(readChangeKeys(" , ")).toEqual([]);
  });

  it("keeps a per-resource key intact", () => {
    expect(
      readChangeKeys(changeKeysHeaderValue([{ key: "workspace:ws_1", scope: "account" }])),
    ).toEqual(["workspace:ws_1"]);
  });
});
