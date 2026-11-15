import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => {
  const limit = vi.fn();
  const selectWhere = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where: selectWhere }));
  const select = vi.fn(() => ({ from }));

  const onConflictDoUpdate = vi.fn();
  const values = vi.fn(() => ({ onConflictDoUpdate }));
  const insert = vi.fn(() => ({ values }));

  return {
    db: { select, insert },
    select,
    from,
    selectWhere,
    limit,
    insert,
    values,
    onConflictDoUpdate,
  };
});

vi.mock("@/lib/db", () => ({ db: dbMocks.db }));

import { userSettings } from "@/lib/db/schema";

import { readReadAloudPreference, setReadAloudPreference } from "./preferences";

beforeEach(() => {
  vi.clearAllMocks();
  dbMocks.limit.mockResolvedValue([]);
  dbMocks.onConflictDoUpdate.mockResolvedValue(undefined);
});

describe("readReadAloudPreference", () => {
  it("is off when the person has no stored choice", async () => {
    await expect(readReadAloudPreference("user_1")).resolves.toBe(false);
  });

  it("returns the stored choice", async () => {
    dbMocks.limit.mockResolvedValue([{ readAloud: true }]);

    await expect(readReadAloudPreference("user_1")).resolves.toBe(true);
  });

  it("looks the choice up in the person's settings row", async () => {
    await readReadAloudPreference("user_1");

    expect(dbMocks.select).toHaveBeenCalledWith({ readAloud: userSettings.readAloud });
    expect(dbMocks.from).toHaveBeenCalledWith(userSettings);
    expect(dbMocks.selectWhere).toHaveBeenCalledTimes(1);
    expect(dbMocks.limit).toHaveBeenCalledWith(1);
  });
});

describe("setReadAloudPreference", () => {
  it("inserts the choice when the person has no settings row yet", async () => {
    await setReadAloudPreference("user_1", true);

    expect(dbMocks.insert).toHaveBeenCalledWith(userSettings);
    expect(dbMocks.values).toHaveBeenCalledWith({ userId: "user_1", readAloud: true });
    expect(dbMocks.onConflictDoUpdate).toHaveBeenCalledTimes(1);
  });

  it("updates the existing settings row for the person", async () => {
    await setReadAloudPreference("user_1", false);

    expect(dbMocks.values).toHaveBeenCalledWith({ userId: "user_1", readAloud: false });
    expect(dbMocks.onConflictDoUpdate).toHaveBeenCalledWith({
      target: userSettings.userId,
      set: { readAloud: false },
    });
  });
});
