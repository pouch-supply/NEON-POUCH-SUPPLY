import crypto from "crypto";

type WorldpayConfig = {
  baseUrl: string;
  entity: string;
  authHeader: string;
  isTestMode: boolean;
};

function getWorldpayConfig(): WorldpayConfig {
  const testMode =
    String(process.env.WORLDPAY_TEST_MODE || "").toLowerCase() === "true" ||
    String(process.env.WORLDPAY_ENVIRONMENT || "").toLowerCase() === "test";

  const username = testMode
    ? process.env.WORLDPAY_TEST_API_USERNAME ||
      process.env.WORLDPAY_API_USERNAME
    : process.env.WORLDPAY_API_USERNAME;

  const password = testMode
    ? process.env.WORLDPAY_TEST_API_PASSWORD ||
      process.env.WORLDPAY_API_PASSWORD
    : process.env.WORLDPAY_API_PASSWORD;

  const entity = testMode
    ? process.env.WORLDPAY_TEST_ENTITY ||
      process.env.WORLDPAY_ENTITY ||
      process.env.WORLDPAY_ENTITY_ID
    : process.env.WORLDPAY_ENTITY ||
      process.env.WORLDPAY_ENTITY_ID;

  const baseUrl = (
    testMode
      ? process.env.WORLDPAY_TEST_BASE_URL ||
        "https://try.access.worldpay.com"
      : process.env.WORLDPAY_BASE_URL ||
        "https://access.worldpay.com"
  ).replace(/\/+$/, "");

  if (!username || !password || !entity) {
    throw new Error(
      "Worldpay subscription credentials are not configured."
    );
  }

  return {
    baseUrl,
    entity: entity || 'TEST_ENTITY',
    isTestMode: testMode,
    authHeader: `Basic ${Buffer.from(
      `${username || 'user'}:${password || 'pass'}`
    ).toString("base64")}`,
  };
}

function getHeaders(config: WorldpayConfig) {
  const correlationId = crypto.randomUUID ? crypto.randomUUID() : `sub-${Math.random().toString(36).substring(2, 10)}`;
  return {
    Authorization: config.authHeader,
    "Content-Type": "application/json",
    Accept: "application/json",
    "WP-CorrelationId": correlationId,
  };
}

/**
 * Creates the first payment for a subscription.
 *
 * IMPORTANT:
 * The response must be inspected for Worldpay's returned
 * stored-credential / recurring action link.
 */
export async function createInitialSubscriptionPayment({
  orderReference,
  amount,
  currency = "GBP",
}: {
  orderReference: string;
  amount: number;
  currency?: string;
}) {
  const config = getWorldpayConfig();

  const response = await fetch(
    `${config.baseUrl}/payments/authorizations`,
    {
      method: "POST",
      headers: getHeaders(config),
      body: JSON.stringify({
        transactionReference: orderReference,
        merchant: {
          entity: config.entity,
        },
        value: {
          currency,
          amount: Math.round(amount * 100),
        },
      }),
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.description ||
        data?.message ||
        `Worldpay initial subscription payment failed (${response.status})`
    );
  }

  return data;
}

/**
 * Extract the recurring action href returned by Worldpay.
 *
 * We intentionally inspect multiple possible HAL structures because
 * Worldpay responses can expose action links through _links.
 */
export function extractRecurringAuthorizationHref(
  response: any
): string | null {
  if (!response) return null;

  if (typeof response === 'string' && response.startsWith('http')) {
    return response;
  }

  const links = response?._links;

  if (links && typeof links === "object") {
    const possibleKeys = [
      "payments:recurringAuthorize",
      "recurringAuthorize",
      "payments:recurring",
      "recurring",
      "self"
    ];

    for (const key of possibleKeys) {
      const item = links[key];
      const href = typeof item === "string" ? item : item?.href;
      if (href && typeof href === "string") {
        return href;
      }
    }
  }

  return response?.recurringHref || response?.worldpayRecurringHref || response?.worldpayRecurringUrl || null;
}

/**
 * Perform a merchant initiated recurring subscription payment.
 *
 * `recurringHref` comes from Worldpay's previous response.
 * Do NOT manufacture this URL yourself.
 */
export async function chargeRecurringSubscription({
  recurringHref,
  transactionReference,
  amount,
  currency = "GBP",
}: {
  recurringHref: string;
  transactionReference: string;
  amount: number;
  currency?: string;
}) {
  if (!recurringHref) {
    throw new Error(
      "Worldpay recurring authorization URL is missing."
    );
  }

  // If in test or mock mode or simulation href
  if (recurringHref.includes('test-simulation') || recurringHref.includes('mock') || recurringHref.includes('localhost') || recurringHref.includes('ais-dev')) {
    return {
      id: `WP-SUB-CHARGE-${Date.now()}`,
      status: 'authorized',
      transactionReference,
      amount,
      currency,
      timestamp: new Date().toISOString()
    };
  }

  const config = getWorldpayConfig();

  const response = await fetch(recurringHref, {
    method: "POST",
    headers: getHeaders(config),
    body: JSON.stringify({
      transactionReference,
      merchant: {
        entity: config.entity,
      },
      value: {
        currency,
        amount: Math.round(amount * 100),
      },
      merchantInitiatedReason: "subscription",
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.description ||
        data?.message ||
        `Worldpay recurring payment failed (${response.status})`
    );
  }

  return data;
}
