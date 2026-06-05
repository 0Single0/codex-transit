import { ArrowRight, Camera, QrCode, ScanLine } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { useAppState } from "../features/app/AppStateContext";
import { parseAgentLoginPayload } from "../pairing";
import { buildDevicesPath, buildLoginPath } from "../routes";

type DetectedBarcode = {
  rawValue?: string;
};

type BarcodeDetectorInstance = {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>;
};

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance;

function detectPlatformLabel() {
  if (typeof navigator === "undefined") return "mobile";
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes("iphone")) return "iPhone";
  if (userAgent.includes("android")) return "Android";
  return "mobile";
}

function readBarcodeDetector(): BarcodeDetectorConstructor | null {
  const detector = (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
  return detector ?? null;
}

export function ScanAgentPage() {
  const { api, labels, token, setMessage, setError, runAuthorized } = useAppState();
  const navigate = useNavigate();
  const [payloadText, setPayloadText] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null);
  const parsed = useMemo(() => parseAgentLoginPayload(payloadText), [payloadText]);

  useEffect(() => {
    if (!token) return;

    const BarcodeDetectorApi = readBarcodeDetector();
    const secureContext = window.isSecureContext;
    const canUseCamera =
      secureContext &&
      BarcodeDetectorApi &&
      typeof navigator !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia);

    setCameraSupported(Boolean(canUseCamera));

    if (!canUseCamera) {
      if (!secureContext) {
        setScanError("Camera scanning requires HTTPS or localhost in this browser.");
      } else if (!BarcodeDetectorApi) {
        setScanError("This browser does not support native QR detection.");
      }
      return;
    }

    let disposed = false;
    detectorRef.current = new BarcodeDetectorApi({ formats: ["qr_code"] });

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" } }
        });
        if (disposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setCameraReady(true);
        scanFrame();
      } catch (error) {
        setScanError(error instanceof Error ? error.message : String(error));
      }
    }

    async function scanFrame() {
      if (disposed) return;
      const video = videoRef.current;
      const detector = detectorRef.current;
      if (!video || !detector || video.readyState < 2) {
        frameRef.current = window.requestAnimationFrame(scanFrame);
        return;
      }

      try {
        const results = await detector.detect(video);
        const rawValue = results[0]?.rawValue?.trim();
        if (rawValue) {
          setPayloadText(rawValue);
          return;
        }
      } catch {
        // Ignore transient detector errors and keep scanning.
      }

      frameRef.current = window.requestAnimationFrame(scanFrame);
    }

    void startCamera();

    return () => {
      disposed = true;
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [token]);

  async function claimPairing() {
    if (!token) {
      navigate(`${buildLoginPath()}?redirect=${encodeURIComponent("/scan-agent")}`);
      return;
    }
    if (!parsed) {
      setError(labels.invalidAgentQr);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const claimed = await runAuthorized(() => api.claimAgentLogin(parsed.pairingToken));
      if (!claimed) return;
      setMessage(labels.pairingClaimed);
      navigate(buildDevicesPath(), { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={labels.scanAgentTitle}
        subtitle={labels.scanAgentHint}
        onBack={() => navigate(token ? buildDevicesPath() : buildLoginPath())}
      />
      <section className="px-5 pb-24 pt-4 text-slate-900">
        <div className="overflow-hidden rounded-[28px] bg-[#0f1117] px-6 py-7 text-white shadow-[0_24px_60px_rgba(15,23,42,0.2)]">
          <div className="mx-auto grid h-[224px] w-full max-w-[224px] place-items-center rounded-[26px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.16),_rgba(255,255,255,0.04)_58%),linear-gradient(180deg,_rgba(255,255,255,0.08),_rgba(255,255,255,0.02))]">
            {cameraSupported ? (
              <div className="relative h-[184px] w-[184px] overflow-hidden rounded-[22px] bg-black shadow-[0_18px_36px_rgba(0,0,0,0.28)]">
                <video
                  autoPlay
                  className="h-full w-full object-cover opacity-90"
                  muted
                  playsInline
                  ref={videoRef}
                />
                <div className="pointer-events-none absolute inset-0 border-[3px] border-white/70" />
                <div className="pointer-events-none absolute inset-x-5 top-1/2 h-[2px] -translate-y-1/2 bg-[#ff9c35] shadow-[0_0_18px_rgba(255,156,53,0.75)]" />
              </div>
            ) : (
              <div className="grid h-[152px] w-[152px] place-items-center rounded-[22px] bg-white text-slate-900 shadow-[0_18px_36px_rgba(0,0,0,0.28)]">
                <QrCode className="h-20 w-20" />
              </div>
            )}
          </div>
          <p className="mt-5 text-center text-[17px] font-medium text-white">
            {cameraSupported ? "Point your camera at the desktop Agent QR" : "Desktop Agent QR login"}
          </p>
          <p className="mt-2 text-center text-sm leading-6 text-white/60">
            {cameraSupported
              ? "Keep the QR inside the frame. Once recognized, this page will fill the desktop login payload automatically."
              : "Use a supported mobile browser and open this page over HTTPS or localhost to scan the desktop Agent QR."}
          </p>
          {cameraSupported ? (
            <p className="mt-3 flex items-center justify-center gap-2 text-xs text-white/60">
              <Camera className="h-4 w-4" />
              {cameraReady ? "Camera ready" : "Requesting camera permission..."}
            </p>
          ) : null}
        </div>

        {scanError ? (
          <p className="mt-4 rounded-[18px] bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-700 shadow-[0_12px_30px_rgba(245,158,11,0.12)]">
            {scanError}
          </p>
        ) : null}

        <div className="mt-5 rounded-[24px] bg-white px-4 py-4 text-sm shadow-[0_14px_34px_rgba(148,163,184,0.12)]">
          <div className="flex items-center gap-3 text-slate-800">
            <ScanLine className="h-5 w-5 text-sky-600" />
            <strong>{parsed ? "Desktop login QR recognized" : "Waiting for QR scan"}</strong>
          </div>
          <p className="mt-2 text-slate-500">
            {parsed ? `Server: ${parsed.serverUrl}` : "Point the camera at the desktop Agent QR to continue."}
          </p>
          {parsed ? <p className="mt-1 text-slate-500">This login will be confirmed from your {detectPlatformLabel()} device.</p> : null}
        </div>

        <button
          className="mt-5 flex h-14 w-full items-center justify-center gap-3 rounded-[22px] bg-sky-600 text-[15px] font-semibold text-white shadow-[0_16px_38px_rgba(14,165,233,0.22)] transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy || !parsed}
          onClick={() => void claimPairing()}
          type="button"
        >
          <ArrowRight className="h-5 w-5" />
          {labels.confirmPairing}
        </button>
      </section>
    </>
  );
}
