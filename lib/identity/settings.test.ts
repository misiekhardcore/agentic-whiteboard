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

import { DEFAULT_PERSONAL_SETTINGS, readPersonalSettings, saveReadAloud } from "./settings";

beforeEach(() => {
  vi.clearAllMocks();
  dbMocks.limit.mockResolvedValue([]);
  dbMocks.onConflictDoUpdate.mockResolvedValue(undefined);
});

describe("readPersonalSettings", () => {
  it("answers every preference with its default when the person has no settings row", async () => {
    await expect(readPersonalSettings("user_1")).resolves.toEqual(DEFAULT_PERSONAL_SETTINGS);
    expect(DEFAULT_PERSONAL_SETTINGS.readAloud).toBe(false);
  });

  it("returns the stored choices", async () => {
    dbMocks.limit.mockResolvedValue([{ readAloud: true }]);

    await expect(readPersonalSettings("user_1")).resolves.toEqual({ readAloud: true });
  });

  it("looks the choices up in the person's settings row", async () => {
    await readPersonalSettings("user_1");

    expect(dbMocks.select).toHaveBeenCalledWith({ readAloud: userSettings.readAloud });
    expect(dbMocks.from).toHaveBeenCalledWith(userSettings);
    expect(dbMocks.selectWhere).toHaveBeenCalledTimes(1);
    expect(dbMocks.limit).toHaveBeenCalledWith(1);
  });

  it("returns a fresh object, so a caller cannot mutate the defaults", async () => {
    const first = await readPersonalSettings("user_1");
    first.readAloud = true;

    await expect(readPersonalSettings("user_1")).resolves.toEqual(DEFAULT_PERSONAL_SETTINGS);
  });
});

describe("saveReadAloud", () => {
  it("inserts the choice when the person has no settings row yet", async () => {
    await saveReadAloud("user_1", true);

    expect(dbMocks.insert).toHaveBeenCalledWith(userSettings);
    expect(dbMocks.values).toHaveBeenCalledWith({ userId: "user_1", readAloud: true });
    expect(dbMocks.onConflictDoUpdate).toHaveBeenCalledTimes(1);
  });

  it("updates only the read aloud column of an existing row", async () => {
    await saveReadAloud("user_1", false);

    expect(dbMocks.values).toHaveBeenCalledWith({ userId: "user_1", readAloud: false });
    expect(dbMocks.onConflictDoUpdate).toHaveBeenCalledWith({
      target: userSettings.userId,
      set: { readAloud: false },
    });
  });
});
