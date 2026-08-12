// src/components/AgeGate.tsx
import React, { useEffect, useState, useImperativeHandle, forwardRef } from "react";
import { ShieldCheck, ShieldAlert, CheckCircle2, Lock, AlertCircle, RefreshCw, ExternalLink } from "lucide-react";

const AGE_APPROVED_STORAGE_KEY = "agechecked-approved";
const AGE_APPROVED_AT_STORAGE_KEY = "agechecked-verified-at";

export interface AgeCheckedResponse {
  avstatus?: {
    agecheckid?: number | string;
    ageverifiedid?: number | string;
    status?: number | string;
    statustext?: string;
    statusText?: string;
  };
  url?: string;
  redirectUrl?: string;
  reference?: string;
  message?: string;
  details?: unknown;
  [key: string]: unknown;
}

function getPortalUrl(publicKey: string, returnUrl?: string) {
  const baseUrl = (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_AGECHECKED_PORTAL_URL) || "https://staging.agechecked.com/portal";

  try {
    const url = new URL(baseUrl);
    if (publicKey && publicKey !== "PUBLIC_KEY") {
      url.searchParams.set("publicKey", publicKey);
    }
    if (returnUrl) {
      url.searchParams.set("returnUrl", returnUrl);
      url.searchParams.set("redirectUrl", returnUrl);
    }
    return url.toString();
  } catch {
    const separator = baseUrl.includes("?") ? "&" : "?";
    const params = [`publicKey=${encodeURIComponent(publicKey)}`];
    if (returnUrl) {
      params.push(`returnUrl=${encodeURIComponent(returnUrl)}`);
      params.push(`redirectUrl=${encodeURIComponent(returnUrl)}`);
    }
    return `${baseUrl}${separator}${params.join("&")}`;
  }
}

function isApprovedStatus(value?: string | null) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "approved" || normalized === "true" || normalized === "6" || normalized === "7";
}

export interface AgeGateProps {
  compact?: boolean;
  onApprovedChange?: (approved: boolean) => void;
  customerData?: {
    name?: string;
    surname?: string;
    email?: string;
    postcode?: string;
    countrycode?: string;
    dob?: string;
    reference?: string;
  };
}

export interface AgeGateHandle {
  openPortal: () => Promise<boolean>;
  resetApproval: () => void;
  isApproved: boolean;
}

export const AgeGate = forwardRef<AgeGateHandle, AgeGateProps>(({ compact = false, onApprovedChange, customerData }, ref) => {
  const [approved, setApproved] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Age verification is required before checkout can continue.");
  const [agecheckId, setAgecheckId] = useState<string | null>(null);

  const publicKey = (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_AGECHECKED_PUBLIC_KEY) || "PUBLIC_KEY";

  const markApproved = (detail?: AgeCheckedResponse) => {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(AGE_APPROVED_STORAGE_KEY, "true");
    window.localStorage.setItem(AGE_APPROVED_AT_STORAGE_KEY, new Date().toISOString());
    setApproved(true);
    setIsChecking(false);
    if (detail?.avstatus?.agecheckid) {
      setAgecheckId(String(detail.avstatus.agecheckid));
    }
    setStatusMessage("Age approval confirmed. Checkout is now available.");
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedValue = window.localStorage.getItem(AGE_APPROVED_STORAGE_KEY);
    const params = new URLSearchParams(window.location.search);
    const isApproved =
      storedValue === "true" ||
      params.get("agechecked") === "approved" ||
      params.get("approved") === "true" ||
      isApprovedStatus(params.get("status"));

    setApproved(isApproved);
    if (params.get("agecheckid")) {
      setAgecheckId(params.get("agecheckid"));
    }
    setStatusMessage(
      isApproved
        ? "Age approval confirmed. Checkout is now available."
        : "Age verification is required before checkout can continue."
    );
  }, []);

  useEffect(() => {
    onApprovedChange?.(approved);
  }, [approved, onApprovedChange]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleMessage = (event: MessageEvent) => {
      const payload = event.data;
      const isApprovedPayload =
        payload && typeof payload === "object" && (payload as { type?: string; status?: string }).type === "agechecked-approved";
      const isApprovedStatusMsg =
        payload && typeof payload === "object" && (payload as { status?: string }).status === "approved";

      if (isApprovedPayload || isApprovedStatusMsg) {
        if (payload?.agecheckid) {
          setAgecheckId(String(payload.agecheckid));
        }
        markApproved(payload as AgeCheckedResponse);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const resetApproval = () => {
    if (typeof window === "undefined") return;

    window.localStorage.removeItem(AGE_APPROVED_STORAGE_KEY);
    window.localStorage.removeItem(AGE_APPROVED_AT_STORAGE_KEY);
    setApproved(false);
    setIsChecking(false);
    setAgecheckId(null);
    setStatusMessage("Age verification is required before checkout can continue.");
  };

  const openPortal = async (): Promise<boolean> => {
    if (typeof window === "undefined") return approved;

    if (approved) return true;

    setIsChecking(true);
    setStatusMessage("Initializing the AgeChecked AC0130 flow and preparing the redirect URL for the age verification session.");

    try {
      const nameParts = (customerData?.name || "Customer").split(" ");
      const firstName = nameParts[0] || "Customer";
      const lastName = nameParts.slice(1).join(" ") || customerData?.surname || "Customer";

      const response = await fetch("/api/agechecked/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: firstName,
          surname: lastName,
          dob: customerData?.dob || "01/01/2000",
          postcode: customerData?.postcode || "EC1A 1BB",
          countrycode: customerData?.countrycode || "GB",
          email: customerData?.email || "customer@example.com",
          reference: customerData?.reference || `ref-${Date.now()}`,
          withforce: "true",
        }),
      });

      const data = (await response.json()) as AgeCheckedResponse & { error?: { message?: string; code?: string } };
      const redirectUrl =
        (data as { url?: string }).url ||
        (data as { redirectUrl?: string }).redirectUrl ||
        (data as { redirect_url?: string }).redirect_url;
      const providerMessage =
        data?.error?.message || data?.message || data?.avstatus?.statusText || data?.avstatus?.statustext;
      const errorMessage = providerMessage ? `${providerMessage}${data?.error?.code ? ` (code: ${data.error.code})` : ""}` : undefined;

      if (!response.ok || !redirectUrl) {
        const details = data?.details ? JSON.stringify(data.details) : "";
        const fallbackMessage = errorMessage
          ? `${errorMessage}${details ? ` — ${details}` : ""}`
          : "AgeChecked did not return a redirect URL.";
        setStatusMessage(`AgeChecked AC0130 initialization notice: ${fallbackMessage}`);
        setIsChecking(false);
        return false;
      }

      setAgecheckId(data?.avstatus?.agecheckid ? String(data.avstatus.agecheckid) : null);
      setStatusMessage("AgeChecked returned a redirect URL. Please complete verification in the opened window.");

      const popup = window.open(redirectUrl, "agechecked", "width=480,height=720,noopener,noreferrer");
      if (!popup) {
        setStatusMessage("Popup window was blocked by browser. Please allow popups or click the verification button again.");
        setIsChecking(false);
        return false;
      }

      const checkPopup = window.setInterval(() => {
        if (!popup.closed) return;
        window.clearInterval(checkPopup);
        setIsChecking(false);
        const isApprovedNow = window.localStorage.getItem(AGE_APPROVED_STORAGE_KEY) === "true";
        if (!isApprovedNow) {
          setStatusMessage("The AgeChecked popup closed before an approval result was received. Please complete verification to proceed.");
        }
      }, 500);

      return false;
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "AgeChecked initialization failed.");
      setIsChecking(false);
      return false;
    }
  };

  useImperativeHandle(ref, () => ({
    openPortal,
    resetApproval,
    isApproved: approved,
  }));

  return (
    <div
      className={`rounded-2xl border p-5 transition-all shadow-sm ${
        approved
          ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-100"
          : "border-amber-500/40 bg-amber-950/20 text-amber-100"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 rounded-full p-2 ${
              approved ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
            }`}
          >
            {approved ? <ShieldCheck className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-bold uppercase tracking-widest ${
                  approved ? "text-emerald-400" : "text-amber-400"
                }`}
              >
                {approved ? "Age Verified (18+ Approved)" : "Age Verification Required"}
              </span>
            </div>
            <h3 className="mt-1 text-base font-semibold text-white">AgeChecked Verification</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-300">{statusMessage}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
              approved
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                : "border-amber-500/50 bg-amber-500/10 text-amber-300"
            }`}
          >
            {approved ? "Approved" : "Pending"}
          </span>
        </div>
      </div>

      {!compact && (
        <p className="mt-3 text-xs text-slate-400 border-t border-slate-700/50 pt-3">
          AgeChecked AC0130 is active for age-restricted purchases. Checkout stays locked until age verification is confirmed.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {!approved ? (
          <button
            type="button"
            onClick={openPortal}
            disabled={isChecking}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
          >
            {isChecking ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" /> Initializing AgeChecked...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" /> Start AgeChecked AC0130 Flow
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={resetApproval}
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            Reset Age Verification
          </button>
        )}
      </div>

      {agecheckId && (
        <p className="mt-3 text-[10px] font-mono uppercase tracking-widest text-slate-400">
          AgeChecked ID: {agecheckId}
        </p>
      )}
    </div>
  );
});

AgeGate.displayName = "AgeGate";
export default AgeGate;
