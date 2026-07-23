"use client";

import { useCallback, useEffect, useReducer } from "react";

import {
  applicationReducer,
  initialApplicationState,
} from "@/application/state";
import type { UserProfile } from "@/domain/profile";
import { createSessionProfileStorage } from "@/storage/profile-storage";
import type { ProfileStorageOperationResult } from "@/storage/profile-storage";

const getSessionProfileStorage = () => {
  try {
    return createSessionProfileStorage(window.sessionStorage);
  } catch {
    return createSessionProfileStorage(null);
  }
};

export const useApplicationState = () => {
  const [state, dispatch] = useReducer(
    applicationReducer,
    initialApplicationState,
  );

  useEffect(() => {
    const restorationResult = getSessionProfileStorage().load();

    dispatch(
      restorationResult.status === "success"
        ? { type: "profileRestored", profile: restorationResult.profile }
        : { type: "profileRestorationFailed" },
    );
  }, []);

  const saveProfile = useCallback(
    (profile: UserProfile): ProfileStorageOperationResult => {
      const persistenceResult = getSessionProfileStorage().save(profile);

      if (persistenceResult.status === "success") {
        dispatch({ type: "profileSaved", profile });
      }

      return persistenceResult;
    },
    [],
  );

  return { state, dispatch, saveProfile } as const;
};
