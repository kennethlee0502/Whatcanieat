import { beforeEach, describe, expect, it } from "vitest";

import type { UserProfile } from "@/domain/profile";
import {
  createSessionProfileStorage,
  SESSION_PROFILE_STORAGE_KEY,
  type ProfileStorage,
} from "@/storage/profile-storage";

const profile: UserProfile = {
  pregnancy: { status: "notPregnant" },
  allergies: [],
  highBloodPressure: false,
  diet: "none",
  measurements: {
    height: { value: 170, unit: "centimeters" },
    weight: { value: 65, unit: "kilograms" },
    bmi: 22.5,
  },
};

const createThrowingStorage = (): Storage => ({
  length: 0,
  clear: () => {
    throw new Error("blocked");
  },
  getItem: () => {
    throw new Error("blocked");
  },
  key: () => null,
  removeItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
});

describe("session profile storage", () => {
  let storage: ProfileStorage;

  beforeEach(() => {
    window.sessionStorage.clear();
    storage = createSessionProfileStorage(window.sessionStorage);
  });

  it("reports browser storage availability", () => {
    expect(storage.isAvailable()).toBe(true);
    expect(createSessionProfileStorage(null).isAvailable()).toBe(false);
    expect(createSessionProfileStorage(createThrowingStorage()).isAvailable()).toBe(false);
  });

  it("saves and loads a validated versioned profile", () => {
    expect(storage.save(profile)).toEqual({ status: "success" });
    expect(storage.load()).toEqual({ status: "success", profile });

    const storedValue = JSON.parse(
      window.sessionStorage.getItem(SESSION_PROFILE_STORAGE_KEY) ?? "null",
    );
    expect(storedValue).toEqual({ schemaVersion: 1, profile });
  });

  it("returns null when no profile has been stored", () => {
    expect(storage.load()).toEqual({ status: "success", profile: null });
  });

  it.each([
    ["malformed JSON", "not-json"],
    ["an outdated version", JSON.stringify({ schemaVersion: 2, profile })],
    ["an invalid profile", JSON.stringify({ schemaVersion: 1, profile: {} })],
  ])("reports invalid data for %s", (_caseName, storedValue) => {
    window.sessionStorage.setItem(SESSION_PROFILE_STORAGE_KEY, storedValue);
    expect(storage.load()).toEqual({ status: "error", reason: "invalidData" });
  });

  it("refuses to save invalid runtime data", () => {
    expect(storage.save({} as UserProfile)).toEqual({
      status: "error",
      reason: "invalidData",
    });
    expect(window.sessionStorage.getItem(SESSION_PROFILE_STORAGE_KEY)).toBeNull();
  });

  it("clears only the namespaced profile", () => {
    window.sessionStorage.setItem("unrelated", "keep");
    storage.save(profile);

    expect(storage.clear()).toEqual({ status: "success" });
    expect(window.sessionStorage.getItem(SESSION_PROFILE_STORAGE_KEY)).toBeNull();
    expect(window.sessionStorage.getItem("unrelated")).toBe("keep");
  });

  it("returns explicit failures when storage is unavailable or blocked", () => {
    const unavailableStorage = createSessionProfileStorage(null);
    const blockedStorage = createSessionProfileStorage(createThrowingStorage());

    expect(unavailableStorage.load()).toEqual({
      status: "error",
      reason: "unavailable",
    });
    expect(blockedStorage.load()).toEqual({
      status: "error",
      reason: "unavailable",
    });
    expect(blockedStorage.save(profile)).toEqual({
      status: "error",
      reason: "writeFailed",
    });
    expect(blockedStorage.clear()).toEqual({
      status: "error",
      reason: "clearFailed",
    });
  });
});
