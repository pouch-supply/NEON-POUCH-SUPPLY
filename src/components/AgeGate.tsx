// src/components/AgeGate.tsx
import React, { useEffect, useState, useImperativeHandle, forwardRef } from "react";
import { ShieldCheck, ShieldAlert, CheckCircle2, Lock, AlertCircle, RefreshCw, ExternalLink } from "lucide-react";
import { trackAgeVerified } from "../utils/klaviyo";

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
  const [statusMessage, setStatusMessage] = useState("Age verification (18+) is required to complete your order.");
  const [agecheckId, setAgecheckId] = useState<string | null>(null);

  const publicKey = (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_AGECHECKED_PUBLIC_KEY) || "PUBLIC_KEY";

  const markApproved = (detail?: AgeCheckedResponse) => {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(AGE_APPROVED_STORAGE_KEY, "true");
    window.localStorage.setItem(AGE_APPROVED_AT_STORAGE_KEY, new Date().toISOString());
    setApproved(true);
    setIsChecking(false);
    const resolvedAgeCheckId = detail?.avstatus?.agecheckid ? String(detail.avstatus.agecheckid) : undefined;
    if (resolvedAgeCheckId) {
      setAgecheckId(resolvedAgeCheckId);
    }
    setStatusMessage("Your age (18+) has been verified successfully.");
    
    // Dispatch Klaviyo Age Verified Event
    try {
      trackAgeVerified({
        agecheck_id: resolvedAgeCheckId,
        email: customerData?.email,
        verified_at: new Date().toISOString(),
      });
    } catch (_e) {}
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
        ? "Your age (18+) has been verified successfully."
        : "Age verification (18+) is required to complete your order."
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
    setStatusMessage("Age verification (18+) is required to complete your order.");
  };

  const openPortal = async (): Promise<boolean> => {
    if (typeof window === "undefined") return approved;

    if (approved) return true;

    setIsChecking(true);
    setStatusMessage("Connecting to AgeChecked verification service...");

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

      if (!response.ok || !redirectUrl) {
        const fallbackMessage = providerMessage || "Age verification session creation failed. Please try again.";
        setStatusMessage(fallbackMessage);
        setIsChecking(false);
        return false;
      }

      setAgecheckId(data?.avstatus?.agecheckid ? String(data.avstatus.agecheckid) : null);
      setStatusMessage("Please complete age verification in the popup window.");

      const popup = window.open(redirectUrl, "agechecked", "width=480,height=720,noopener,noreferrer");
      if (!popup) {
        setStatusMessage("Popup was blocked by your browser. Please allow popups and try again.");
        setIsChecking(false);
        return false;
      }

      const checkPopup = window.setInterval(() => {
        if (!popup.closed) return;
        window.clearInterval(checkPopup);
        setIsChecking(false);
        const isApprovedNow = window.localStorage.getItem(AGE_APPROVED_STORAGE_KEY) === "true";
        if (!isApprovedNow) {
          setStatusMessage("Verification window closed before completion. Please try again.");
        }
      }, 500);

      return false;
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Age verification failed.");
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
      className={`rounded-2xl border p-4 sm:p-5 transition-all shadow-xs ${
        approved
          ? "border-emerald-200 bg-emerald-50/80 text-emerald-950"
          : "border-amber-200 bg-amber-50/80 text-amber-950"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 rounded-xl p-2.5 shrink-0 ${
              approved ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
            }`}
          >
            {approved ? <ShieldCheck className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-black uppercase tracking-wider ${
                  approved ? "text-emerald-800" : "text-amber-800"
                }`}
              >
                {approved ? "Age Verified (18+ Approved)" : "Age Verification Required"}
              </span>
            </div>
            <h3 className="mt-0.5 text-sm font-bold text-slate-900">AgeChecked Verification</h3>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">{statusMessage}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
              approved
                ? "border-emerald-300 bg-emerald-100/80 text-emerald-800"
                : "border-amber-300 bg-amber-100/80 text-amber-800"
            }`}
          >
            {approved ? "Verified" : "Pending"}
          </span>
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-3">
        {!approved ? (
          <button
            type="button"
            onClick={openPortal}
            disabled={isChecking}
            className="flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 shadow-xs cursor-pointer"
          >
            {isChecking ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" /> Verifying...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" /> Verify Age (18+)
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={resetApproval}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer"
          >
            Reset Verification
          </button>
        )}
      </div>

      {agecheckId && (
        <p className="mt-2 text-[10px] font-mono text-slate-400">
          Ref: {agecheckId}
        </p>
      )}
    </div>
  );
});

AgeGate.displayName = "AgeGate";
export default AgeGate;
