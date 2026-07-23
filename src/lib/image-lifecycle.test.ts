import { renderHook, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createImageLifecycle,
  MAX_PREPARED_IMAGE_BYTES,
  MAX_PREPARED_IMAGE_EDGE,
  MAX_SOURCE_IMAGE_BYTES,
  prepareImage,
  type DecodedImage,
  type ImagePreparationEnvironment,
  type ImagePreparationResult,
} from "@/lib/image-lifecycle";

const createFile = (
  type = "image/jpeg",
  size = 1,
  name = "food.jpg",
) => {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
};

const createBlob = (size: number, type = "image/jpeg") => {
  const blob = new Blob(["x"], { type });
  Object.defineProperty(blob, "size", { value: size });
  return blob;
};

const createDecodedImage = (
  width: number,
  height: number,
  close = vi.fn(),
): DecodedImage => ({
  width,
  height,
  source: {} as CanvasImageSource,
  close,
});

const createEnvironment = (
  dimensions = { width: 1200, height: 900 },
  encodedSize = 1024,
) => {
  const close = vi.fn();
  const environment: ImagePreparationEnvironment = {
    decode: vi
      .fn()
      .mockResolvedValue(
        createDecodedImage(dimensions.width, dimensions.height, close),
      ),
    encode: vi.fn().mockResolvedValue(createBlob(encodedSize)),
  };
  return { environment, close };
};

const successfulResult = (
  size = 1024,
  width = 1200,
  height = 900,
): ImagePreparationResult => ({
  status: "success",
  image: {
    blob: createBlob(size),
    width,
    height,
    mimeType: "image/jpeg",
    sizeBytes: size,
  },
});

const createDeferred = <Value,>() => {
  let resolve!: (value: Value) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const installImageElementFallback = (decodeSucceeds: boolean) => {
  const createObjectUrl = vi.fn().mockReturnValue("blob:decode");
  const revokeObjectUrl = vi.fn();

  class MockImage {
    naturalWidth = 1200;
    naturalHeight = 900;
    onload: ((event: Event) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;

    set src(_value: string) {
      queueMicrotask(() => {
        if (decodeSucceeds) {
          this.onload?.(new Event("load"));
        } else {
          this.onerror?.(new Event("error"));
        }
      });
    }
  }

  const encodedBlob = createBlob(1024);
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn().mockReturnValue({
      fillStyle: "",
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    }),
    toBlob: vi.fn().mockImplementation((callback: (blob: Blob) => void) => {
      callback(encodedBlob);
    }),
  } as unknown as HTMLCanvasElement;

  vi.stubGlobal("Image", MockImage);
  vi.stubGlobal("URL", {
    createObjectURL: createObjectUrl,
    revokeObjectURL: revokeObjectUrl,
  });
  vi.spyOn(document, "createElement").mockReturnValue(canvas);

  return { createObjectUrl, revokeObjectUrl };
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

describe("prepareImage", () => {
  it.each(["image/jpeg", "image/png", "image/webp", "image/heic"])(
    "prepares a natively decodable %s image",
    async (type) => {
      const { environment, close } = createEnvironment();

      const result = await prepareImage(
        createFile(type),
        new AbortController().signal,
        environment,
      );

      expect(result).toMatchObject({
        status: "success",
        image: { width: 1200, height: 900, sizeBytes: 1024 },
      });
      expect(close).toHaveBeenCalledOnce();
    },
  );

  it("rejects unsupported and empty files before decoding", async () => {
    const { environment } = createEnvironment();

    await expect(
      prepareImage(
        createFile("image/gif"),
        new AbortController().signal,
        environment,
      ),
    ).resolves.toEqual({
      status: "error",
      error: { code: "unsupportedImage", retryable: false },
    });
    await expect(
      prepareImage(
        createFile("image/jpeg", 0),
        new AbortController().signal,
        environment,
      ),
    ).resolves.toEqual({
      status: "error",
      error: { code: "invalidImage", retryable: false },
    });
    expect(environment.decode).not.toHaveBeenCalled();
  });

  it("rejects an oversized source before decoding", async () => {
    const { environment } = createEnvironment();

    await expect(
      prepareImage(
        createFile("image/jpeg", MAX_SOURCE_IMAGE_BYTES + 1),
        new AbortController().signal,
        environment,
      ),
    ).resolves.toEqual({
      status: "error",
      error: { code: "imageTooLarge", retryable: false },
    });
    expect(environment.decode).not.toHaveBeenCalled();
  });

  it.each([
    [{ width: 4032, height: 3024 }, { width: 2048, height: 1536 }],
    [{ width: 3024, height: 4032 }, { width: 1536, height: 2048 }],
    [{ width: 1200, height: 900 }, { width: 1200, height: 900 }],
  ])(
    "preserves oriented aspect ratio for $0",
    async (sourceDimensions, expectedDimensions) => {
      const { environment } = createEnvironment(sourceDimensions);

      const result = await prepareImage(
        createFile(),
        new AbortController().signal,
        environment,
      );

      expect(result).toMatchObject({
        status: "success",
        image: expectedDimensions,
      });
      expect(environment.encode).toHaveBeenCalledWith(
        expect.anything(),
        expectedDimensions.width,
        expectedDimensions.height,
        "image/jpeg",
        0.86,
        expect.any(AbortSignal),
      );
      expect(
        Math.max(expectedDimensions.width, expectedDimensions.height),
      ).toBeLessThanOrEqual(MAX_PREPARED_IMAGE_EDGE);
    },
  );

  it("uses browser-normalized EXIF dimensions without applying orientation twice", async () => {
    const { environment } = createEnvironment({ width: 3000, height: 4000 });

    const result = await prepareImage(
      createFile(),
      new AbortController().signal,
      environment,
    );

    expect(result).toMatchObject({
      status: "success",
      image: { width: 1536, height: 2048 },
    });
  });

  it("reduces quality and dimensions until output fits the hard limit", async () => {
    const { environment } = createEnvironment({ width: 4000, height: 3000 });
    vi.mocked(environment.encode)
      .mockResolvedValueOnce(createBlob(MAX_PREPARED_IMAGE_BYTES + 100))
      .mockResolvedValueOnce(createBlob(MAX_PREPARED_IMAGE_BYTES + 100))
      .mockResolvedValueOnce(createBlob(MAX_PREPARED_IMAGE_BYTES + 100))
      .mockResolvedValueOnce(createBlob(MAX_PREPARED_IMAGE_BYTES + 100))
      .mockResolvedValueOnce(createBlob(1024));

    const result = await prepareImage(
      createFile(),
      new AbortController().signal,
      environment,
    );

    expect(environment.encode).toHaveBeenCalledTimes(5);
    expect(result).toMatchObject({
      status: "success",
      image: { width: 1741, height: 1306, sizeBytes: 1024 },
    });
    if (result.status === "success") {
      expect(result.image.sizeBytes).toBeLessThanOrEqual(
        MAX_PREPARED_IMAGE_BYTES,
      );
    }
  });

  it("fails safely when bounded compression cannot meet the hard limit", async () => {
    const { environment } = createEnvironment(
      { width: 4000, height: 3000 },
      MAX_PREPARED_IMAGE_BYTES + 1,
    );

    await expect(
      prepareImage(
        createFile(),
        new AbortController().signal,
        environment,
      ),
    ).resolves.toEqual({
      status: "error",
      error: { code: "imageTooLarge", retryable: false },
    });
  });

  it("maps failed native HEIC decoding to an unsupported-image result", async () => {
    const { environment } = createEnvironment();
    vi.mocked(environment.decode).mockRejectedValue(new Error("unsupported"));

    await expect(
      prepareImage(
        createFile("image/heic"),
        new AbortController().signal,
        environment,
      ),
    ).resolves.toEqual({
      status: "error",
      error: { code: "unsupportedImage", retryable: false },
    });
  });

  it("falls back to image-element decoding after createImageBitmap fails", async () => {
    const createImageBitmapMock = vi.fn().mockRejectedValue(new Error("failed"));
    vi.stubGlobal("createImageBitmap", createImageBitmapMock);
    const { createObjectUrl, revokeObjectUrl } =
      installImageElementFallback(true);

    const result = await prepareImage(
      createFile(),
      new AbortController().signal,
    );

    expect(result).toMatchObject({
      status: "success",
      image: { width: 1200, height: 900, sizeBytes: 1024 },
    });
    expect(createImageBitmapMock).toHaveBeenCalledOnce();
    expect(createObjectUrl).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:decode");
  });

  it.each([
    ["image/jpeg", "invalidImage"],
    ["image/heic", "unsupportedImage"],
  ] as const)(
    "returns %s's safe error when both browser decoders fail",
    async (type, expectedCode) => {
      vi.stubGlobal(
        "createImageBitmap",
        vi.fn().mockRejectedValue(new Error("bitmap failed")),
      );
      const { createObjectUrl, revokeObjectUrl } =
        installImageElementFallback(false);

      await expect(
        prepareImage(createFile(type), new AbortController().signal),
      ).resolves.toEqual({
        status: "error",
        error: { code: expectedCode, retryable: false },
      });
      expect(createObjectUrl).toHaveBeenCalledOnce();
      expect(revokeObjectUrl).toHaveBeenCalledOnce();
      expect(revokeObjectUrl).toHaveBeenCalledWith("blob:decode");
    },
  );

  it("does not attempt image-element fallback after cancellation", async () => {
    const bitmapDecode = createDeferred<ImageBitmap>();
    const imageConstructor = vi.fn();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockReturnValue(bitmapDecode.promise),
    );
    vi.stubGlobal("Image", imageConstructor);
    const controller = new AbortController();
    const resultPromise = prepareImage(createFile(), controller.signal);

    controller.abort();
    bitmapDecode.reject(new Error("bitmap failed"));

    await expect(resultPromise).resolves.toEqual({ status: "canceled" });
    expect(imageConstructor).not.toHaveBeenCalled();
  });

  it("cancels stale decode work and closes the decoded image", async () => {
    const deferred = createDeferred<DecodedImage>();
    const close = vi.fn();
    const environment: ImagePreparationEnvironment = {
      decode: vi.fn().mockReturnValue(deferred.promise),
      encode: vi.fn(),
    };
    const controller = new AbortController();
    const resultPromise = prepareImage(
      createFile(),
      controller.signal,
      environment,
    );

    controller.abort();
    deferred.resolve(createDecodedImage(1200, 900, close));

    await expect(resultPromise).resolves.toEqual({ status: "canceled" });
    expect(environment.encode).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
  });
});

describe("image lifecycle", () => {
  it("publishes a prepared image and keeps image data out of sessionStorage", async () => {
    window.sessionStorage.setItem("unrelated", "keep");
    const createObjectUrl = vi.fn().mockReturnValue("blob:prepared");
    const onPrepared = vi.fn();
    const lifecycle = createImageLifecycle({
      prepare: vi.fn().mockResolvedValue(successfulResult()),
      createObjectUrl,
      revokeObjectUrl: vi.fn(),
      createImageId: () => "image-1",
      onPrepared,
    });

    await lifecycle.select(createFile()).completion;

    expect(createObjectUrl).toHaveBeenCalledOnce();
    expect(onPrepared).toHaveBeenCalledWith(
      "image-1",
      expect.objectContaining({ objectUrl: "blob:prepared" }),
    );
    expect(window.sessionStorage.length).toBe(1);
    expect(window.sessionStorage.getItem("unrelated")).toBe("keep");
  });

  it("cancels stale work during replacement and publishes only the replacement", async () => {
    const first = createDeferred<ImagePreparationResult>();
    const second = createDeferred<ImagePreparationResult>();
    const signals: AbortSignal[] = [];
    const prepare = vi
      .fn()
      .mockImplementationOnce((_file, signal: AbortSignal) => {
        signals.push(signal);
        return first.promise;
      })
      .mockImplementationOnce((_file, signal: AbortSignal) => {
        signals.push(signal);
        return second.promise;
      });
    const onPrepared = vi.fn();
    const onCanceled = vi.fn();
    const createObjectUrl = vi.fn().mockReturnValue("blob:second");
    const lifecycle = createImageLifecycle({
      prepare,
      createObjectUrl,
      revokeObjectUrl: vi.fn(),
      createImageId: vi
        .fn()
        .mockReturnValueOnce("image-1")
        .mockReturnValueOnce("image-2"),
      onPrepared,
      onCanceled,
    });

    const firstHandle = lifecycle.select(createFile());
    const secondHandle = lifecycle.select(createFile());
    expect(signals[0]?.aborted).toBe(true);
    first.resolve(successfulResult());
    second.resolve(successfulResult());
    await Promise.all([firstHandle.completion, secondHandle.completion]);

    expect(onCanceled).toHaveBeenCalledWith("image-1");
    expect(createObjectUrl).toHaveBeenCalledOnce();
    expect(onPrepared).toHaveBeenCalledOnce();
    expect(onPrepared).toHaveBeenCalledWith("image-2", expect.anything());
  });

  it("does not publish a stale failure after replacement", async () => {
    const first = createDeferred<ImagePreparationResult>();
    const second = createDeferred<ImagePreparationResult>();
    const onFailed = vi.fn();
    const lifecycle = createImageLifecycle({
      prepare: vi
        .fn()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise),
      createObjectUrl: vi.fn().mockReturnValue("blob:second"),
      revokeObjectUrl: vi.fn(),
      createImageId: vi
        .fn()
        .mockReturnValueOnce("image-1")
        .mockReturnValueOnce("image-2"),
      onFailed,
    });

    const firstHandle = lifecycle.select(createFile());
    const secondHandle = lifecycle.select(createFile());
    first.resolve({
      status: "error",
      error: { code: "invalidImage", retryable: false },
    });
    second.resolve(successfulResult());
    await Promise.all([firstHandle.completion, secondHandle.completion]);

    expect(onFailed).not.toHaveBeenCalled();
    expect(lifecycle.getPreparedImage()).toMatchObject({
      objectUrl: "blob:second",
    });
  });

  it("maps a current rejected preparation to a safe resolved failure", async () => {
    const onFailed = vi.fn();
    const lifecycle = createImageLifecycle({
      prepare: vi.fn().mockRejectedValue(new Error("unexpected")),
      createImageId: () => "image-1",
      onFailed,
    });

    await expect(lifecycle.select(createFile()).completion).resolves.toBeUndefined();

    expect(onFailed).toHaveBeenCalledOnce();
    expect(onFailed).toHaveBeenCalledWith("image-1", {
      code: "invalidImage",
      retryable: false,
    });
  });

  it("does not publish a stale rejected preparation after replacement", async () => {
    const first = createDeferred<ImagePreparationResult>();
    const second = createDeferred<ImagePreparationResult>();
    const onFailed = vi.fn();
    const lifecycle = createImageLifecycle({
      prepare: vi
        .fn()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise),
      createObjectUrl: vi.fn().mockReturnValue("blob:second"),
      revokeObjectUrl: vi.fn(),
      createImageId: vi
        .fn()
        .mockReturnValueOnce("image-1")
        .mockReturnValueOnce("image-2"),
      onFailed,
    });

    const firstHandle = lifecycle.select(createFile());
    const secondHandle = lifecycle.select(createFile());
    first.reject(new Error("unexpected"));
    second.resolve(successfulResult());
    await expect(
      Promise.all([firstHandle.completion, secondHandle.completion]),
    ).resolves.toBeDefined();

    expect(onFailed).not.toHaveBeenCalled();
    expect(lifecycle.getPreparedImage()).toMatchObject({
      objectUrl: "blob:second",
    });
  });

  it("remains usable after a rejected preparation", async () => {
    const onFailed = vi.fn();
    const onPrepared = vi.fn();
    const lifecycle = createImageLifecycle({
      prepare: vi
        .fn()
        .mockRejectedValueOnce(new Error("unexpected"))
        .mockResolvedValueOnce(successfulResult()),
      createObjectUrl: vi.fn().mockReturnValue("blob:second"),
      revokeObjectUrl: vi.fn(),
      createImageId: vi
        .fn()
        .mockReturnValueOnce("image-1")
        .mockReturnValueOnce("image-2"),
      onFailed,
      onPrepared,
    });

    await lifecycle.select(createFile()).completion;
    await lifecycle.select(createFile()).completion;

    expect(onFailed).toHaveBeenCalledOnce();
    expect(onPrepared).toHaveBeenCalledWith("image-2", expect.anything());
  });

  it("revokes a prepared URL exactly once when replacing it", async () => {
    const revokeObjectUrl = vi.fn();
    const lifecycle = createImageLifecycle({
      prepare: vi.fn().mockResolvedValue(successfulResult()),
      createObjectUrl: vi
        .fn()
        .mockReturnValueOnce("blob:first")
        .mockReturnValueOnce("blob:second"),
      revokeObjectUrl,
      createImageId: vi
        .fn()
        .mockReturnValueOnce("image-1")
        .mockReturnValueOnce("image-2"),
    });

    await lifecycle.select(createFile()).completion;
    await lifecycle.select(createFile()).completion;

    expect(revokeObjectUrl).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:first");
  });

  it("supports cancellation and ignores its late result", async () => {
    const deferred = createDeferred<ImagePreparationResult>();
    let signal: AbortSignal | undefined;
    const onCanceled = vi.fn();
    const createObjectUrl = vi.fn();
    const lifecycle = createImageLifecycle({
      prepare: vi.fn().mockImplementation((_file, operationSignal) => {
        signal = operationSignal;
        return deferred.promise;
      }),
      createObjectUrl,
      revokeObjectUrl: vi.fn(),
      createImageId: () => "image-1",
      onCanceled,
    });

    const handle = lifecycle.select(createFile());
    lifecycle.cancel();
    expect(signal?.aborted).toBe(true);
    deferred.resolve(successfulResult());
    await handle.completion;

    expect(onCanceled).toHaveBeenCalledOnce();
    expect(createObjectUrl).not.toHaveBeenCalled();
  });

  it("removes active and prepared images with complete cleanup", async () => {
    const active = createDeferred<ImagePreparationResult>();
    const onRemoved = vi.fn();
    const revokeObjectUrl = vi.fn();
    const lifecycle = createImageLifecycle({
      prepare: vi
        .fn()
        .mockReturnValueOnce(active.promise)
        .mockResolvedValueOnce(successfulResult()),
      createObjectUrl: vi.fn().mockReturnValue("blob:prepared"),
      revokeObjectUrl,
      createImageId: vi
        .fn()
        .mockReturnValueOnce("image-1")
        .mockReturnValueOnce("image-2"),
      onRemoved,
    });

    const activeHandle = lifecycle.select(createFile());
    lifecycle.remove();
    active.resolve(successfulResult());
    await activeHandle.completion;
    expect(onRemoved).toHaveBeenCalledWith("image-1");

    await lifecycle.select(createFile()).completion;
    lifecycle.remove();
    expect(onRemoved).toHaveBeenCalledWith("image-2");
    expect(revokeObjectUrl).toHaveBeenCalledOnce();
    expect(lifecycle.getPreparedImage()).toBeNull();
  });

  it("clears and disposes idempotently without double-revoking URLs", async () => {
    const revokeObjectUrl = vi.fn();
    const lifecycle = createImageLifecycle({
      prepare: vi.fn().mockResolvedValue(successfulResult()),
      createObjectUrl: vi.fn().mockReturnValue("blob:prepared"),
      revokeObjectUrl,
      createImageId: () => "image-1",
    });

    await lifecycle.select(createFile()).completion;
    lifecycle.clear();
    lifecycle.clear();
    lifecycle.dispose();
    lifecycle.dispose();

    expect(revokeObjectUrl).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:prepared");
  });

  it("clear cancels active preparation without publishing its late result", async () => {
    const deferred = createDeferred<ImagePreparationResult>();
    let activeSignal: AbortSignal | undefined;
    const createObjectUrl = vi.fn();
    const lifecycle = createImageLifecycle({
      prepare: vi.fn().mockImplementation((_file, signal) => {
        activeSignal = signal;
        return deferred.promise;
      }),
      createObjectUrl,
      revokeObjectUrl: vi.fn(),
      createImageId: () => "image-1",
    });

    const handle = lifecycle.select(createFile());
    lifecycle.clear();
    expect(activeSignal?.aborted).toBe(true);
    deferred.resolve(successfulResult());
    await handle.completion;

    expect(createObjectUrl).not.toHaveBeenCalled();
  });

  it("does not cancel preparation merely because the browser backgrounds", () => {
    let activeSignal: AbortSignal | undefined;
    const lifecycle = createImageLifecycle({
      prepare: vi.fn().mockImplementation((_file, signal) => {
        activeSignal = signal;
        return new Promise<ImagePreparationResult>(() => undefined);
      }),
      createImageId: () => "image-1",
    });

    lifecycle.select(createFile());
    document.dispatchEvent(new Event("visibilitychange"));

    expect(activeSignal?.aborted).toBe(false);
    lifecycle.dispose();
  });

  it("disposes active work and prepared URLs when its React owner unmounts", async () => {
    const deferred = createDeferred<ImagePreparationResult>();
    const revokeObjectUrl = vi.fn();
    let activeSignal: AbortSignal | undefined;
    const useLifecycleOwner = () => {
      useEffect(() => {
        const lifecycle = createImageLifecycle({
          prepare: vi.fn().mockImplementation((_file, signal) => {
            activeSignal = signal;
            return deferred.promise;
          }),
          createObjectUrl: vi.fn(),
          revokeObjectUrl,
          createImageId: () => "image-1",
        });
        lifecycle.select(createFile());
        return () => lifecycle.dispose();
      }, []);
    };
    const { unmount } = renderHook(() => useLifecycleOwner());

    unmount();

    expect(activeSignal?.aborted).toBe(true);
    deferred.resolve(successfulResult());
    await Promise.resolve();
    expect(revokeObjectUrl).not.toHaveBeenCalled();
  });

  it("revokes a prepared URL when its React owner unmounts", async () => {
    const revokeObjectUrl = vi.fn();
    const createObjectUrl = vi.fn().mockReturnValue("blob:prepared");
    const useLifecycleOwner = () => {
      useEffect(() => {
        const lifecycle = createImageLifecycle({
          prepare: vi.fn().mockResolvedValue(successfulResult()),
          createObjectUrl,
          revokeObjectUrl,
          createImageId: () => "image-1",
        });
        lifecycle.select(createFile());
        return () => lifecycle.dispose();
      }, []);
    };
    const { unmount } = renderHook(() => useLifecycleOwner());
    await waitFor(() => expect(createObjectUrl).toHaveBeenCalledOnce());

    unmount();

    expect(revokeObjectUrl).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:prepared");
  });
});
