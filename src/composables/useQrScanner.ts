import { ref, shallowRef } from 'vue';
import type { Ref, ShallowRef } from 'vue';
import QrScanner from 'qr-scanner';

export interface QrCamera {
  id: string;
  label: string;
}

export interface QrScanResult {
  data: string;
  at: number;
}

export type CameraPermissionState = 'unknown' | 'prompt' | 'granted' | 'denied' | 'unsupported';

export interface UseQrScannerReturn {
  videoRef: Ref<HTMLVideoElement | null>;
  isStarting: Ref<boolean>;
  isScanning: Ref<boolean>;
  hasTorch: Ref<boolean>;
  torchOn: Ref<boolean>;
  cameras: Ref<QrCamera[]>;
  activeCameraId: Ref<string | null>;
  error: Ref<string | null>;
  permissionState: Ref<CameraPermissionState>;
  lastResult: ShallowRef<QrScanResult | null>;
  start: (onDecode: (result: QrScanResult) => void) => Promise<boolean>;
  stop: () => Promise<void>;
  toggleTorch: () => Promise<boolean>;
  switchCamera: (cameraId: string) => Promise<void>;
  isSecureContext: () => boolean;
  isCameraApiAvailable: () => boolean;
}

function describeMediaError(e: unknown): string {
  if (typeof DOMException !== 'undefined' && e instanceof DOMException) {
    switch (e.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return 'Camera permission was denied. Enable camera access for this site in your browser settings, then try again.';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'No camera was found on this device.';
      case 'NotReadableError':
      case 'TrackStartError':
        return 'The camera is busy or unavailable. Close other apps or tabs that may be using it, then try again.';
      case 'OverconstrainedError':
      case 'ConstraintNotSatisfiedError':
        return 'No camera matches the requested constraints on this device.';
      case 'SecurityError':
        return 'Camera access is blocked by your browser or device security settings.';
      case 'AbortError':
        return 'The camera was interrupted. Try again.';
      default:
        return `Could not start camera (${e.name}): ${e.message}`;
    }
  }
  if (e instanceof Error) return `Could not start camera: ${e.message}`;
  return `Could not start camera: ${String(e)}`;
}

export function useQrScanner(): UseQrScannerReturn {
  const videoRef = ref<HTMLVideoElement | null>(null);
  const isStarting = ref(false);
  const isScanning = ref(false);
  const hasTorch = ref(false);
  const torchOn = ref(false);
  const cameras = ref<QrCamera[]>([]);
  const activeCameraId = ref<string | null>(null);
  const error = ref<string | null>(null);
  const permissionState = ref<CameraPermissionState>('unknown');
  const lastResult = shallowRef<QrScanResult | null>(null);

  let scanner: QrScanner | null = null;
  let onDecodeCb: ((result: QrScanResult) => void) | null = null;
  let detachTrackEnded: (() => void) | null = null;

  const isSecureContext = (): boolean => {
    if (typeof window === 'undefined') return false;
    return window.isSecureContext || window.location.hostname === 'localhost';
  };

  const isCameraApiAvailable = (): boolean => {
    return (
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    );
  };

  const queryPermissionState = async (): Promise<void> => {
    if (
      typeof navigator === 'undefined' ||
      !('permissions' in navigator) ||
      !navigator.permissions?.query
    ) {
      return;
    }
    try {
      const result = await navigator.permissions.query({
        // 'camera' is valid in WebKit/Blink but not yet in stock TS lib types.
        name: 'camera' as PermissionName,
      });
      permissionState.value = result.state as CameraPermissionState;
    } catch {
      // Firefox and some Safari builds reject the 'camera' permission name; leave as-is.
    }
  };

  const refreshTorchCapability = async (): Promise<void> => {
    if (!scanner) {
      hasTorch.value = false;
      return;
    }
    try {
      hasTorch.value = await scanner.hasFlash();
    } catch {
      hasTorch.value = false;
    }
  };

  const refreshCameras = async (): Promise<void> => {
    try {
      const list = await QrScanner.listCameras(true);
      cameras.value = list.map((c) => ({ id: c.id, label: c.label || 'Camera' }));
    } catch {
      cameras.value = [];
    }
  };

  const attachTrackEndedHandler = (): void => {
    if (detachTrackEnded) {
      detachTrackEnded();
      detachTrackEnded = null;
    }
    const stream = videoRef.value?.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks?.()[0];
    if (!track) return;
    const onEnded = (): void => {
      error.value =
        'The camera stopped unexpectedly. Another app or tab may have taken it — tap "Enable camera" to try again.';
      void stop();
    };
    track.addEventListener('ended', onEnded);
    detachTrackEnded = () => track.removeEventListener('ended', onEnded);
  };

  const start = async (onDecode: (result: QrScanResult) => void): Promise<boolean> => {
    if (!videoRef.value) {
      error.value = 'Video element not ready.';
      return false;
    }
    if (!isSecureContext()) {
      permissionState.value = 'unsupported';
      error.value =
        'Camera requires a secure context (HTTPS or localhost). Open the site over HTTPS to scan.';
      return false;
    }
    if (!isCameraApiAvailable()) {
      permissionState.value = 'unsupported';
      error.value =
        'Camera API is not available in this browser. iOS only allows camera access in Safari or apps using its WebKit engine.';
      return false;
    }

    onDecodeCb = onDecode;
    isStarting.value = true;
    error.value = null;
    await queryPermissionState();

    try {
      scanner = new QrScanner(
        videoRef.value,
        (result) => {
          const payload: QrScanResult = { data: result.data, at: Date.now() };
          lastResult.value = payload;
          onDecodeCb?.(payload);
        },
        {
          preferredCamera: 'environment',
          highlightScanRegion: true,
          highlightCodeOutline: true,
          maxScansPerSecond: 5,
          returnDetailedScanResult: true,
          // Match the visible scan region to the reticle frame in
          // AttendanceScanView (~min(70vw, 70vh, 320px)), shrunk slightly so
          // the bracket highlight sits inside the frame.
          //
          // The qr-scanner region is in VIDEO pixels, but the reticle is sized
          // in CSS pixels and the <video> uses object-fit: cover — so we have
          // to convert CSS px → video px through the same cover-scale the
          // browser uses, otherwise the bracket can render wider than the
          // frame on landscape-camera-in-portrait-viewport setups.
          calculateScanRegion: (video: HTMLVideoElement) => {
            const rect = video.getBoundingClientRect();
            const reticleCss = Math.min(window.innerWidth * 0.7, window.innerHeight * 0.7, 320);
            const targetCss = reticleCss * 0.9; // sit inside the frame
            const coverScale = Math.max(
              rect.width / video.videoWidth,
              rect.height / video.videoHeight,
            );
            // Fall back to a half of the smaller video dim if the rect/scale
            // is degenerate (e.g. zero before layout settles).
            const safeScale = coverScale > 0 ? coverScale : 1;
            const maxVideo = Math.min(video.videoWidth, video.videoHeight);
            const size = Math.max(80, Math.min(maxVideo, Math.round(targetCss / safeScale)));
            return {
              x: Math.round((video.videoWidth - size) / 2),
              y: Math.round((video.videoHeight - size) / 2),
              width: size,
              height: size,
            };
          },
        },
      );

      try {
        await scanner.start();
      } catch (firstErr) {
        // Front-only devices (laptops, some iPads) reject the 'environment' constraint.
        // Retry once with the front camera so the scanner still works.
        const overconstrained =
          firstErr instanceof DOMException &&
          (firstErr.name === 'OverconstrainedError' ||
            firstErr.name === 'ConstraintNotSatisfiedError');
        if (!overconstrained) throw firstErr;
        try {
          await scanner.setCamera('user');
        } catch {
          throw firstErr;
        }
      }

      isScanning.value = true;
      permissionState.value = 'granted';

      // enumerateDevices returns blank labels until permission is granted, so
      // we list cameras only after start() resolves.
      await refreshCameras();
      const tracks = (videoRef.value.srcObject as MediaStream | null)?.getVideoTracks?.();
      const settings = tracks?.[0]?.getSettings?.();
      activeCameraId.value = settings?.deviceId ?? null;

      attachTrackEndedHandler();
      await refreshTorchCapability();
      torchOn.value = false;
      return true;
    } catch (e) {
      if (e instanceof DOMException) {
        if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
          permissionState.value = 'denied';
        } else if (e.name === 'SecurityError') {
          permissionState.value = 'unsupported';
        }
      }
      error.value = describeMediaError(e);
      await stop();
      return false;
    } finally {
      isStarting.value = false;
    }
  };

  const stop = async (): Promise<void> => {
    if (detachTrackEnded) {
      try {
        detachTrackEnded();
      } catch {
        // ignore
      }
      detachTrackEnded = null;
    }
    if (scanner) {
      try {
        scanner.stop();
        scanner.destroy();
      } catch {
        // ignore — destroy can throw if already torn down
      }
      scanner = null;
    }
    if (videoRef.value && videoRef.value.srcObject) {
      const stream = videoRef.value.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.value.srcObject = null;
    }
    isScanning.value = false;
    hasTorch.value = false;
    torchOn.value = false;
  };

  const toggleTorch = async (): Promise<boolean> => {
    if (!scanner) return false;
    try {
      if (torchOn.value) {
        await scanner.turnFlashOff();
        torchOn.value = false;
      } else {
        await scanner.turnFlashOn();
        torchOn.value = true;
      }
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      error.value = `Torch unavailable: ${msg}`;
      torchOn.value = false;
      hasTorch.value = false;
      return false;
    }
  };

  const switchCamera = async (cameraId: string): Promise<void> => {
    if (!scanner) return;
    try {
      await scanner.setCamera(cameraId);
      activeCameraId.value = cameraId;
      attachTrackEndedHandler();
      torchOn.value = false;
      await refreshTorchCapability();
    } catch (e) {
      error.value = describeMediaError(e);
    }
  };

  return {
    videoRef,
    isStarting,
    isScanning,
    hasTorch,
    torchOn,
    cameras,
    activeCameraId,
    error,
    permissionState,
    lastResult,
    start,
    stop,
    toggleTorch,
    switchCamera,
    isSecureContext,
    isCameraApiAvailable,
  };
}
