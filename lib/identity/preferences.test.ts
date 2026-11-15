import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => {
  const limit = vi.fn();
  const selectWhere = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where: selectWhere }));
  const select = vi.fn(() => ({ from }));

  const updateWhere = vi.fn();
  const set = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set }));

  return {
    db: { select, update },
    select,
    from,
    selectWhere,
    limit,
    update,
    set,
    updateWhere,
  };
});

vi.mock("@/lib/db", () => ({ db: dbMocks.db }));

import { user } from "@/lib/db/schema";

import { readReadAloudPreference, setReadAloudPreference } from "./preferences";

beforeEach(() => {
  vi.clearAllMocks();
  dbMocks.limit.mockResolvedValue([]);
  dbMocks.updateWhere.mockResolvedValue(undefined);
});

describe("readReadAloudPreference", () => {
  it("is off when the person has no stored choice", async () => {
    await expect(readReadAloudPreference("user_1")).resolves.toBe(false);
  });

  it("returns the stored choice", async () => {
    dbMocks.limit.mockResolvedValue([{ readAloud: true }]);

    await expect(readReadAloudPreference("user_1")).resolves.toBe(true);
  });

  it("looks the preference up by the person's id", async () => {
    await readReadAloudPreference("user_1");

    expect(dbMocks.select).toHaveBeenCalledWith({ readAloud: user.readAloud });
    expect(dbMocks.from).toHaveBeenCalledTimes(1);
    expect(dbMocks.selectWhere).toHaveBeenCalledTimes(1);
    expect(dbMocks.limit).toHaveBeenCalledWith(1);
  });
});

describe("setReadAloudPreference", () => {
  it("stores the choice on the person's row", async () => {
    await setReadAloudPreference("user_1", true);

    expect(dbMocks.update).toHaveBeenCalledTimes(1);
    expect(dbMocks.set).toHaveBeenCalledWith({ readAloud: true });
    expect(dbMocks.updateWhere).toHaveBeenCalledTimes(1);
  });

  it("stores an explicit off", async () => {
    await setReadAloudPreference("user_1", false);

    expect(dbMocks.set).toHaveBeenCalledWith({ readAloud: false });
  });
});
