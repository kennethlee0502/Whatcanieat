import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useApplicationState } from "@/application/use-application-state";
import type { UserProfile } from "@/domain/profile";
import { SESSION_PROFILE_STORAGE_KEY } from "@/storage/profile-storage";

const profile: UserProfile = {
  pregnancy: { status: "notPregnant" },
  allergies: [],
  highBloodPressure: false,
  diet: "none",
};

describe("useApplicationState", () => {
  beforeEach(() => window.sessionStorage.clear());
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("restores a stored profile only after the hook mounts", async () => {
    window.sessionStorage.setItem(
      SESSION_PROFILE_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 1, profile }),
    );

    const { result } = renderHook(() => useApplicationState());

    await waitFor(() => expect(result.current.state.kind).toBe("capture"));
    expect(result.current.state).toEqual({ kind: "capture", profile });
  });

  it("recovers safely from corrupt stored data", async () => {
    window.sessionStorage.setItem(SESSION_PROFILE_STORAGE_KEY, "not-json");

    const { result } = renderHook(() => useApplicationState());

    await waitFor(() => expect(result.current.state.kind).toBe("welcome"));
  });

  it("persists a valid profile before dispatching profileSaved", async () => {
    const { result } = renderHook(() => useApplicationState());
    await waitFor(() => expect(result.current.state.kind).toBe("welcome"));

    let saveResult;
    act(() => {
      result.current.dispatch({ type: "profileStarted" });
    });
    act(() => {
      saveResult = result.current.saveProfile(profile);
    });
    expect(saveResult).toEqual({ status: "success" });

    await waitFor(() => expect(result.current.state).toEqual({ kind: "capture", profile }));
    expect(JSON.parse(window.sessionStorage.getItem(SESSION_PROFILE_STORAGE_KEY)!)).toEqual({
      schemaVersion: 1,
      profile,
    });
  });

  it("does not dispatch profileSaved when persistence fails", async () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("blocked");
      });
    const { result } = renderHook(() => useApplicationState());
    await waitFor(() => expect(result.current.state.kind).toBe("welcome"));

    let saveResult;
    act(() => {
      result.current.dispatch({ type: "profileStarted" });
    });
    act(() => {
      saveResult = result.current.saveProfile(profile);
    });
    expect(saveResult).toEqual({
      status: "error",
      reason: "writeFailed",
    });
    expect(result.current.state.kind).toBe("profile");

    setItem.mockRestore();
  });

  it("keeps the last stored profile while continuing with an update in memory", async () => {
    window.sessionStorage.setItem(
      SESSION_PROFILE_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 1, profile }),
    );
    const updatedProfile: UserProfile = {
      ...profile,
      highBloodPressure: true,
    };
    const { result, unmount } = renderHook(() => useApplicationState());
    await waitFor(() =>
      expect(result.current.state).toEqual({ kind: "capture", profile }),
    );
    act(() => {
      result.current.dispatch({ type: "profileEditRequested" });
    });

    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("blocked");
      });
    let saveResult;
    act(() => {
      saveResult = result.current.saveProfile(updatedProfile);
    });
    expect(saveResult).toEqual({
      status: "error",
      reason: "writeFailed",
    });
    act(() => {
      result.current.dispatch({
        type: "profileContinuedInMemory",
        profile: updatedProfile,
      });
    });
    expect(result.current.state).toEqual({
      kind: "capture",
      profile: updatedProfile,
    });

    setItem.mockRestore();
    expect(
      JSON.parse(
        window.sessionStorage.getItem(SESSION_PROFILE_STORAGE_KEY) ?? "null",
      ),
    ).toEqual({ schemaVersion: 1, profile });

    unmount();
    const restored = renderHook(() => useApplicationState());
    await waitFor(() =>
      expect(restored.result.current.state).toEqual({
        kind: "capture",
        profile,
      }),
    );
  });

  it("returns to welcome after refresh when a memory-only profile was never stored", async () => {
    const memoryOnlyProfile: UserProfile = {
      ...profile,
      diet: "vegetarian",
    };
    const { result, unmount } = renderHook(() => useApplicationState());
    await waitFor(() => expect(result.current.state.kind).toBe("welcome"));
    act(() => {
      result.current.dispatch({ type: "profileStarted" });
      result.current.dispatch({
        type: "profileContinuedInMemory",
        profile: memoryOnlyProfile,
      });
    });
    await waitFor(() =>
      expect(result.current.state).toEqual({
        kind: "capture",
        profile: memoryOnlyProfile,
      }),
    );
    expect(
      window.sessionStorage.getItem(SESSION_PROFILE_STORAGE_KEY),
    ).toBeNull();

    unmount();
    const restored = renderHook(() => useApplicationState());
    await waitFor(() =>
      expect(restored.result.current.state.kind).toBe("welcome"),
    );
  });
});
