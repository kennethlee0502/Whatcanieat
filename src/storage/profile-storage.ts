import {
  storedProfileEnvelopeSchema,
  userProfileSchema,
  type UserProfile,
} from "@/domain/profile";

export const SESSION_PROFILE_STORAGE_KEY = "can-i-eat-this:profile";

export type ProfileStorageFailure =
  | "unavailable"
  | "invalidData"
  | "writeFailed"
  | "clearFailed";

export type ProfileLoadResult =
  | Readonly<{ status: "success"; profile: UserProfile | null }>
  | Readonly<{ status: "error"; reason: ProfileStorageFailure }>;

export type ProfileStorageOperationResult =
  | Readonly<{ status: "success" }>
  | Readonly<{ status: "error"; reason: ProfileStorageFailure }>;

export interface ProfileStorage {
  isAvailable(): boolean;
  load(): ProfileLoadResult;
  save(profile: UserProfile): ProfileStorageOperationResult;
  clear(): ProfileStorageOperationResult;
}

export const createSessionProfileStorage = (
  sessionStorage: Storage | null,
): ProfileStorage => ({
  isAvailable: () => {
    if (!sessionStorage) {
      return false;
    }

    const probeKey = `${SESSION_PROFILE_STORAGE_KEY}:probe`;

    try {
      sessionStorage.setItem(probeKey, "available");
      sessionStorage.removeItem(probeKey);
      return true;
    } catch {
      return false;
    }
  },

  load: () => {
    if (!sessionStorage) {
      return { status: "error", reason: "unavailable" };
    }

    let serializedProfile: string | null;

    try {
      serializedProfile = sessionStorage.getItem(SESSION_PROFILE_STORAGE_KEY);
    } catch {
      return { status: "error", reason: "unavailable" };
    }

    if (serializedProfile === null) {
      return { status: "success", profile: null };
    }

    try {
      const validationResult = storedProfileEnvelopeSchema.safeParse(
        JSON.parse(serializedProfile),
      );

      return validationResult.success
        ? { status: "success", profile: validationResult.data.profile }
        : { status: "error", reason: "invalidData" };
    } catch {
      return { status: "error", reason: "invalidData" };
    }
  },

  save: (profile) => {
    if (!sessionStorage) {
      return { status: "error", reason: "unavailable" };
    }

    const profileValidation = userProfileSchema.safeParse(profile);

    if (!profileValidation.success) {
      return { status: "error", reason: "invalidData" };
    }

    try {
      sessionStorage.setItem(
        SESSION_PROFILE_STORAGE_KEY,
        JSON.stringify({ schemaVersion: 1, profile: profileValidation.data }),
      );
      return { status: "success" };
    } catch {
      return { status: "error", reason: "writeFailed" };
    }
  },

  clear: () => {
    if (!sessionStorage) {
      return { status: "error", reason: "unavailable" };
    }

    try {
      sessionStorage.removeItem(SESSION_PROFILE_STORAGE_KEY);
      return { status: "success" };
    } catch {
      return { status: "error", reason: "clearFailed" };
    }
  },
});
