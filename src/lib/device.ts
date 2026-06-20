// Browser-only device fingerprint helper.
// Best-effort identification of the physical device + install — never the sole auth.
import { supabase } from "@/integrations/supabase/client";

const FP_KEY = "mealnest_device_fp";
const INSTALL_KEY = "mealnest_install_id";
const DEVICE_ID_KEY = "mealnest_device_id";

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function canvasSignal(): string {
  try {
    const c = document.createElement("canvas");
    c.width = 200; c.height = 50;
    const ctx = c.getContext("2d");
    if (!ctx) return "no-2d";
    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillStyle = "#f60";
    ctx.fillRect(0, 0, 100, 50);
    ctx.fillStyle = "#069";
    ctx.fillText("mealnest-fp \u{1F37D}", 2, 2);
    return c.toDataURL();
  } catch { return "canvas-err"; }
}

function webglSignal(): string {
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl") || c.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return "no-gl";
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (!ext) return gl.getParameter(gl.VERSION) as string;
    return `${gl.getParameter((ext as any).UNMASKED_VENDOR_WEBGL)}|${gl.getParameter((ext as any).UNMASKED_RENDERER_WEBGL)}`;
  } catch { return "gl-err"; }
}

function getInstallId(): string {
  let id = localStorage.getItem(INSTALL_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(INSTALL_KEY, id);
  }
  return id;
}

export async function getDeviceFingerprint(): Promise<string> {
  if (typeof window === "undefined") return "";
  const cached = localStorage.getItem(FP_KEY);
  if (cached) return cached;
  const install = getInstallId();
  const signals = [
    install,
    navigator.userAgent,
    navigator.language,
    navigator.platform,
    String(navigator.hardwareConcurrency ?? ""),
    String((navigator as any).deviceMemory ?? ""),
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    String(new Date().getTimezoneOffset()),
    canvasSignal(),
    webglSignal(),
  ].join("||");
  const fp = await sha256Hex(signals);
  localStorage.setItem(FP_KEY, fp);
  return fp;
}

export function getCachedDeviceFingerprint(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(FP_KEY);
}

export function getCachedDeviceId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(DEVICE_ID_KEY);
}

export function setCachedDeviceId(id: string) {
  localStorage.setItem(DEVICE_ID_KEY, id);
}

/** Registers the device with the backend; idempotent. Stores device id for reuse. */
export async function ensureDeviceRegistered(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const fp = await getDeviceFingerprint();
    const { data, error } = await supabase.rpc("register_device" as any, {
      _fingerprint: fp,
      _ua: navigator.userAgent,
      _platform: navigator.platform,
      _ip: null,
    } as any);
    if (error) return null;
    const id = data as unknown as string;
    if (id) setCachedDeviceId(id);
    return id ?? null;
  } catch {
    return null;
  }
}
