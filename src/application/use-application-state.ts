"use client";

import { useEffect, useReducer } from "react";

import {
  applicationReducer,
  initialApplicationState,
} from "@/application/state";
import { createSessionProfileStorage } from "@/storage/profile-storage";

export const useApplicationState = () => {
  const [state, dispatch] = useReducer(
    applicationReducer,
    initialApplicationState,
  );

  useEffect(() => {
    let browserSessionStorage: Storage;

    try {
      browserSessionStorage = window.sessionStorage;
    } catch {
      dispatch({ type: "profileRestorationFailed" });
      return;
    }

    const restorationResult =
      createSessionProfileStorage(browserSessionStorage).load();

    dispatch(
      restorationResult.status === "success"
        ? { type: "profileRestored", profile: restorationResult.profile }
        : { type: "profileRestorationFailed" },
    );
  }, []);

  return { state, dispatch } as const;
};
