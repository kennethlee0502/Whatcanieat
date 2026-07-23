import type { AnalysisError } from "@/domain/analysis";

export const MAX_SOURCE_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_PREPARED_IMAGE_BYTES = 4 * 1024 * 1024;
export const TARGET_PREPARED_IMAGE_BYTES = Math.floor(3.5 * 1024 * 1024);
export const MAX_PREPARED_IMAGE_EDGE = 2048;

const ACCEPTED_SOURCE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const CONDITIONALLY_SUPPORTED_SOURCE_TYPES = new Set([
  "image/heic",
  "image/heif",
]);
const JPEG_QUALITY_STEPS = [0.86, 0.76, 0.66, 0.56] as const;
const MAX_DIMENSION_REDUCTION_STEPS = 4;
const DIMENSION_REDUCTION_FACTOR = 0.85;

export type PreparedImage = Readonly<{
  blob: Blob;
  objectUrl: string;
  width: number;
  height: number;
  mimeType: string;
  sizeBytes: number;
}>;

type PreparedImageData = Omit<PreparedImage, "objectUrl">;

export type ImagePreparationResult =
  | Readonly<{ status: "success"; image: PreparedImageData }>
  | Readonly<{ status: "error"; error: AnalysisError }>
  | Readonly<{ status: "canceled" }>;

export interface DecodedImage {
  readonly width: number;
  readonly height: number;
  readonly source: CanvasImageSource;
  close(): void;
}

export interface ImagePreparationEnvironment {
  decode(file: File, signal: AbortSignal): Promise<DecodedImage>;
  encode(
    image: DecodedImage,
    width: number,
    height: number,
    mimeType: string,
    quality: number,
    signal: AbortSignal,
  ): Promise<Blob>;
}

export type ImagePreparationOperation = (
  file: File,
  signal: AbortSignal,
) => Promise<ImagePreparationResult>;

type ImageLifecycleOptions = Readonly<{
  prepare?: ImagePreparationOperation;
  createObjectUrl?: (blob: Blob) => string;
  revokeObjectUrl?: (url: string) => void;
  createImageId?: () => string;
  onSelected?: (imageId: string) => void;
  onPrepared?: (imageId: string, image: PreparedImage) => void;
  onFailed?: (imageId: string, error: AnalysisError) => void;
  onCanceled?: (imageId: string) => void;
  onRemoved?: (imageId: string) => void;
}>;

export type ImagePreparationHandle = Readonly<{
  imageId: string;
  completion: Promise<void>;
}>;

export interface ImageLifecycle {
  select(file: File): ImagePreparationHandle;
  cancel(): void;
  remove(): void;
  clear(): void;
  dispose(): void;
  getPreparedImage(): PreparedImage | null;
}

type ActiveOperation = {
  imageId: string;
  controller: AbortController;
};

const getPreparedDimensions = (width: number, height: number) => {
  const longestEdge = Math.max(width, height);

  if (longestEdge <= MAX_PREPARED_IMAGE_EDGE) {
    return { width, height };
  }

  const scale = MAX_PREPARED_IMAGE_EDGE / longestEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

const canceledResult: ImagePreparationResult = { status: "canceled" };

const invalidImageResult = (
  code: "invalidImage" | "unsupportedImage" | "imageTooLarge",
): ImagePreparationResult => ({
  status: "error",
  error: { code, retryable: false },
});

const isCanceled = (signal: AbortSignal) => signal.aborted;

export const prepareImage = async (
  file: File,
  signal: AbortSignal,
  environment: ImagePreparationEnvironment = browserImagePreparationEnvironment,
): Promise<ImagePreparationResult> => {
  if (isCanceled(signal)) {
    return canceledResult;
  }
  if (!ACCEPTED_SOURCE_TYPES.has(file.type)) {
    return invalidImageResult("unsupportedImage");
  }
  if (file.size <= 0) {
    return invalidImageResult("invalidImage");
  }
  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    return invalidImageResult("imageTooLarge");
  }

  let decodedImage: DecodedImage | null = null;

  try {
    decodedImage = await environment.decode(file, signal);

    if (isCanceled(signal)) {
      return canceledResult;
    }
    if (
      !Number.isFinite(decodedImage.width) ||
      !Number.isFinite(decodedImage.height) ||
      decodedImage.width <= 0 ||
      decodedImage.height <= 0
    ) {
      return invalidImageResult("invalidImage");
    }

    let dimensions = getPreparedDimensions(
      decodedImage.width,
      decodedImage.height,
    );
    let lastBlob: Blob | null = null;

    for (
      let reductionStep = 0;
      reductionStep <= MAX_DIMENSION_REDUCTION_STEPS;
      reductionStep += 1
    ) {
      for (const quality of JPEG_QUALITY_STEPS) {
        if (isCanceled(signal)) {
          return canceledResult;
        }

        lastBlob = await environment.encode(
          decodedImage,
          dimensions.width,
          dimensions.height,
          "image/jpeg",
          quality,
          signal,
        );

        if (isCanceled(signal)) {
          return canceledResult;
        }
        if (lastBlob.size <= TARGET_PREPARED_IMAGE_BYTES) {
          return {
            status: "success",
            image: {
              blob: lastBlob,
              width: dimensions.width,
              height: dimensions.height,
              mimeType: lastBlob.type || "image/jpeg",
              sizeBytes: lastBlob.size,
            },
          };
        }
      }

      if (lastBlob && lastBlob.size <= MAX_PREPARED_IMAGE_BYTES) {
        return {
          status: "success",
          image: {
            blob: lastBlob,
            width: dimensions.width,
            height: dimensions.height,
            mimeType: lastBlob.type || "image/jpeg",
            sizeBytes: lastBlob.size,
          },
        };
      }

      dimensions = {
        width: Math.max(
          1,
          Math.round(dimensions.width * DIMENSION_REDUCTION_FACTOR),
        ),
        height: Math.max(
          1,
          Math.round(dimensions.height * DIMENSION_REDUCTION_FACTOR),
        ),
      };
    }

    return invalidImageResult("imageTooLarge");
  } catch {
    if (isCanceled(signal)) {
      return canceledResult;
    }

    return invalidImageResult(
      CONDITIONALLY_SUPPORTED_SOURCE_TYPES.has(file.type)
        ? "unsupportedImage"
        : "invalidImage",
    );
  } finally {
    decodedImage?.close();
  }
};

const decodeWithImageElement = (file: File, signal: AbortSignal) =>
  new Promise<DecodedImage>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    let settled = false;

    const cleanup = () => {
      signal.removeEventListener("abort", handleAbort);
      URL.revokeObjectURL(objectUrl);
    };
    const settle = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      callback();
    };
    const handleAbort = () => settle(() => reject(new DOMException("Aborted")));

    signal.addEventListener("abort", handleAbort, { once: true });
    image.onload = () =>
      settle(() =>
        resolve({
          width: image.naturalWidth,
          height: image.naturalHeight,
          source: image,
          close: () => undefined,
        }),
      );
    image.onerror = () =>
      settle(() => reject(new DOMException("Image decoding failed")));
    image.src = objectUrl;

    if (signal.aborted) {
      handleAbort();
    }
  });

const browserImagePreparationEnvironment: ImagePreparationEnvironment = {
  decode: async (file, signal) => {
    if (typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(file, {
          imageOrientation: "from-image",
        });

        return {
          width: bitmap.width,
          height: bitmap.height,
          source: bitmap,
          close: () => bitmap.close(),
        };
      } catch {
        if (signal.aborted) {
          throw new DOMException("Aborted");
        }
      }
    }

    return decodeWithImageElement(file, signal);
  },

  encode: (image, width, height, mimeType, quality, signal) =>
    new Promise<Blob>((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException("Aborted"));
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");

      if (!context) {
        reject(new DOMException("Canvas is unavailable"));
        return;
      }

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image.source, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new DOMException("Image encoding failed"));
            return;
          }
          resolve(blob);
        },
        mimeType,
        quality,
      );
    }),
};

export const createImageLifecycle = (
  options: ImageLifecycleOptions = {},
): ImageLifecycle => {
  const prepare =
    options.prepare ??
    ((file, signal) => prepareImage(file, signal));
  const createObjectUrl =
    options.createObjectUrl ?? ((blob: Blob) => URL.createObjectURL(blob));
  const revokeObjectUrl =
    options.revokeObjectUrl ?? ((url: string) => URL.revokeObjectURL(url));
  const createImageId =
    options.createImageId ??
    (() =>
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`);

  let activeOperation: ActiveOperation | null = null;
  let preparedImage: (PreparedImage & { imageId: string }) | null = null;
  let disposed = false;

  const releasePreparedImage = () => {
    if (!preparedImage) {
      return;
    }

    const objectUrl = preparedImage.objectUrl;
    preparedImage = null;
    revokeObjectUrl(objectUrl);
  };

  const cancelActiveOperation = (announce: boolean) => {
    if (!activeOperation) {
      return null;
    }

    const operation = activeOperation;
    activeOperation = null;
    operation.controller.abort();
    if (announce) {
      options.onCanceled?.(operation.imageId);
    }
    return operation.imageId;
  };

  const remove = () => {
    const activeImageId = cancelActiveOperation(false);
    const preparedImageId = preparedImage?.imageId ?? null;
    releasePreparedImage();
    const removedImageId = activeImageId ?? preparedImageId;

    if (removedImageId) {
      options.onRemoved?.(removedImageId);
    }
  };

  return {
    select: (file) => {
      if (disposed) {
        throw new Error("Cannot select an image after lifecycle disposal.");
      }

      cancelActiveOperation(true);
      releasePreparedImage();

      const imageId = createImageId();
      const operation: ActiveOperation = {
        imageId,
        controller: new AbortController(),
      };
      activeOperation = operation;
      options.onSelected?.(imageId);

      const completion = prepare(file, operation.controller.signal).then(
        (result) => {
          if (activeOperation !== operation || disposed) {
            return;
          }

          activeOperation = null;

          if (result.status === "canceled") {
            options.onCanceled?.(imageId);
            return;
          }
          if (result.status === "error") {
            options.onFailed?.(imageId, result.error);
            return;
          }

          let objectUrl: string;

          try {
            objectUrl = createObjectUrl(result.image.blob);
          } catch {
            options.onFailed?.(imageId, {
              code: "invalidImage",
              retryable: false,
            });
            return;
          }

          if (disposed || activeOperation !== null) {
            revokeObjectUrl(objectUrl);
            return;
          }

          preparedImage = {
            ...result.image,
            imageId,
            objectUrl,
          };
          options.onPrepared?.(imageId, preparedImage);
        },
        () => {
          if (activeOperation !== operation || disposed) {
            return;
          }

          activeOperation = null;
          options.onFailed?.(imageId, {
            code: "invalidImage",
            retryable: false,
          });
        },
      );

      return { imageId, completion };
    },

    cancel: () => {
      cancelActiveOperation(true);
    },

    remove,
    clear: remove,

    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      cancelActiveOperation(false);
      releasePreparedImage();
    },

    getPreparedImage: () => preparedImage,
  };
};
