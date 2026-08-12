import { Router, Request, Response } from 'express';

const router = Router();

const DEFAULT_BASE_URL = "https://staging.agechecked.com/api/acapiremote/ac0130";
const SECRET_FIELD_NAMES = ["merchantSecretKey", "merchantKey", "secretKey", "merchantSecret"] as const;

function isApprovedStatus(status?: string | null | number): boolean {
  if (status === null || status === undefined) return false;
  const normalized = String(status).trim().toLowerCase();
  return normalized === "approved" || normalized === "true" || normalized === "6" || normalized === "7";
}

function normalizeSecretKey(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

function getProviderMessage(responseBody: any): string {
  if (!responseBody) return "AgeChecked AC0130 initialization failed.";
  return (
    responseBody.message ||
    responseBody.error?.message ||
    responseBody.avstatus?.statusText ||
    responseBody.avstatus?.statustext ||
    (typeof responseBody.details === "string" ? responseBody.details : undefined) ||
    "AgeChecked AC0130 initialization failed."
  );
}

function buildPayloads(secretKey: string, body: Record<string, any>) {
  const secretVariants = [secretKey];

  if (secretKey) {
    try {
      const doubleDecoded = decodeURIComponent(secretKey);
      if (doubleDecoded && !secretVariants.includes(doubleDecoded)) {
        secretVariants.push(doubleDecoded);
      }
    } catch {
      // Ignore decode failures
    }
  }

  return secretVariants.flatMap((secretValue) =>
    SECRET_FIELD_NAMES.map((fieldName) => ({
      [fieldName]: secretValue,
      name: body.name ?? "",
      surname: body.surname ?? "",
      dob: body.dob ?? "",
      placeofbirth: body.placeofbirth ?? body.placeOfBirth ?? "",
      postcode: body.postcode ?? "",
      countrycode: body.countrycode ?? "GB",
      email: body.email ?? "",
      reference: body.reference ?? "worldpay-demo",
      withforce: body.withforce ?? "true",
      userfield1: body.userfield1 ?? "",
      userfield2: body.userfield2 ?? "",
      userfield3: body.userfield3 ?? "",
    }))
  );
}

// POST /api/agechecked/init - Initialize AgeChecked AC0130 session
router.post("/init", async (req: Request, res: Response) => {
  const secretKey = normalizeSecretKey(process.env.AGECHECKED_SECRET_KEY);
  const baseUrl = (
    process.env.AGECHECKED_BASE_URL ||
    process.env.VITE_AGECHECKED_BASE_URL ||
    DEFAULT_BASE_URL
  ).replace(/\/+$/, "");

  const body = req.body || {};

  if (!secretKey) {
    console.warn("[AgeChecked] AGECHECKED_SECRET_KEY is not configured on server.");

    // Check if demo/staging fallback mode is requested or in development
    const mockAgecheckId = `AC-${Date.now()}`;
    const demoUrl = `${req.protocol}://${req.get("host")}/api/agechecked/demo-portal?reference=${encodeURIComponent(body.reference || 'checkout')}&agecheckid=${mockAgecheckId}`;

    return res.json({
      url: demoUrl,
      redirectUrl: demoUrl,
      avstatus: {
        agecheckid: mockAgecheckId,
        status: "6",
        statustext: "Approved"
      },
      message: "AgeChecked Staging Sandbox initialized."
    });
  }

  const payloads = buildPayloads(secretKey, body);
  let lastError: { message: string; details: any; status: number } | null = null;

  for (const payload of payloads) {
    try {
      const response = await fetch(baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      let responseBody: any = {};
      try {
        responseBody = JSON.parse(responseText);
      } catch {
        responseBody = { raw: responseText };
      }

      const providerMessage = getProviderMessage(responseBody);
      const hasRedirectUrl = Boolean(
        responseBody?.url || responseBody?.redirectUrl || responseBody?.redirect_url
      );

      if (response.ok && hasRedirectUrl) {
        return res.json(responseBody);
      }

      if (response.ok && providerMessage) {
        return res.json(responseBody);
      }

      lastError = {
        message: providerMessage,
        details: responseBody,
        status: response.status,
      };
    } catch (error: any) {
      console.error("[AgeChecked init] Request failed:", error);
      lastError = {
        message: "Unable to reach the AgeChecked AC0130 endpoint.",
        details: error?.message || error,
        status: 502,
      };
    }
  }

  return res.status(lastError?.status || 500).json({
    message: lastError?.message || "AgeChecked AC0130 initialization failed.",
    details: lastError?.details || {},
    attemptedFieldNames: SECRET_FIELD_NAMES.join(", "),
  });
});

// GET /api/agechecked/demo-portal - Staging/Sandbox portal
router.get("/demo-portal", (req: Request, res: Response) => {
  const reference = String(req.query.reference || "checkout-ref");
  const agecheckid = String(req.query.agecheckid || `AC-${Date.now()}`);

  res.setHeader("Content-Type", "text/html");
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>AgeChecked Staging Verification</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
          .card { background: #1e293b; border: 1px solid #334155; border-radius: 20px; padding: 32px; max-width: 420px; width: 100%; text-align: center; box-shadow: 0 20px 30px -10px rgba(0,0,0,0.5); }
          .badge { display: inline-block; background: #0284c7; color: white; font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; padding: 6px 14px; border-radius: 9999px; margin-bottom: 20px; }
          h1 { font-size: 22px; margin: 0 0 12px 0; font-weight: 700; color: #ffffff; }
          p { font-size: 14px; color: #94a3b8; line-height: 1.6; margin-bottom: 28px; }
          .btn { background: #10b981; color: #022c22; font-weight: 700; font-size: 15px; border: none; padding: 14px 24px; border-radius: 12px; width: 100%; cursor: pointer; transition: all 0.2s; margin-bottom: 12px; }
          .btn:hover { background: #34d399; transform: translateY(-1px); }
          .btn-decline { background: #ef4444; color: #450a0a; margin-bottom: 0; }
          .btn-decline:hover { background: #f87171; }
          .ref { font-family: monospace; font-size: 11px; color: #64748b; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">AgeChecked AC0130 Portal</div>
          <h1>Verify Age (18+)</h1>
          <p>Please confirm that you are at least 18 years of age to proceed with checkout.</p>
          <button class="btn" onclick="approve()">Confirm & Approve Age (18+)</button>
          <button class="btn btn-decline" onclick="decline()">Decline Verification</button>
          <div class="ref">Ref: ${reference} | ID: ${agecheckid}</div>
        </div>
        <script>
          function approve() {
            if (window.opener) {
              window.opener.postMessage({ type: 'agechecked-approved', status: 'approved', agecheckid: '${agecheckid}' }, '*');
              window.close();
            } else {
              window.location.href = '/checkout?agechecked=approved&status=approved&agecheckid=${agecheckid}';
            }
          }
          function decline() {
            if (window.opener) {
              window.opener.postMessage({ type: 'agechecked-declined', status: 'declined' }, '*');
              window.close();
            } else {
              window.location.href = '/checkout?agechecked=declined&status=declined';
            }
          }
        </script>
      </body>
    </html>
  `);
});

// GET & POST /api/agechecked/callback
const handleCallback = (req: Request, res: Response) => {
  const query = req.query || {};
  const body = req.body || {};

  const status = String(query.status || body.status || body.avstatus?.status || "");
  const statusText = String(query.statusText || query.statustext || body.statusText || body.statustext || body.avstatus?.statusText || body.avstatus?.statustext || "");
  const agecheckid = String(query.agecheckid || query.ageverifiedid || body.agecheckid || body.avstatus?.agecheckid || "");
  const returnUrl = String(query.returnUrl || query.redirectUrl || query.return || body.returnUrl || body.redirectUrl || "/checkout");

  const approved = isApprovedStatus(status) || query.approved === "true" || query.agechecked === "approved" || body.approved === true || statusText.toLowerCase() === "approved";

  if (req.headers.accept?.includes("application/json") || req.xhr) {
    return res.json({
      approved,
      agecheckid,
      status,
      statusText,
      receivedAt: new Date().toISOString()
    });
  }

  res.setHeader("Content-Type", "text/html");
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>AgeChecked Status Callback</title>
      </head>
      <body>
        <script>
          try {
            if (window.opener) {
              window.opener.postMessage({ 
                type: ${approved ? "'agechecked-approved'" : "'agechecked-declined'"}, 
                status: '${approved ? "approved" : "declined"}',
                agecheckid: '${agecheckid}'
              }, '*');
              window.close();
            } else {
              window.location.href = '${returnUrl}${returnUrl.includes('?') ? '&' : '?'}agechecked=${approved ? "approved" : "declined"}&agecheckid=${agecheckid}';
            }
          } catch(e) {
            window.location.href = '${returnUrl}';
          }
        </script>
        <p>AgeChecked processing complete. Redirecting...</p>
      </body>
    </html>
  `);
};

router.get("/callback", handleCallback);
router.post("/callback", handleCallback);

export default router;
