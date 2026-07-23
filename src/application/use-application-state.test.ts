import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

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
  afterEach(cleanup);

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
});
