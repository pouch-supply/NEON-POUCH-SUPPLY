const ROYAL_MAIL_API_URL =
  process.env.ROYAL_MAIL_API_URL ||
  process.env.RM_API_BASE_URL ||
  process.env.ROYAL_MAIL_BASE_URL ||
  "https://api.parcel.royalmail.com/api/v1";

export class RoyalMailError extends Error {
  status: number;
  details: unknown;

  constructor(
    message: string,
    status: number,
    details?: unknown
  ) {
    super(message);
    this.name = "RoyalMailError";
    this.status = status;
    this.details = details;
  }
}

function getAuthHeader(apiKey?: string): string {
  const key = apiKey || process.env.ROYAL_MAIL_API_KEY || process.env.RM_API_KEY || "";
  if (!key) return "";
  return key.startsWith("Bearer ") ? key : `Bearer ${key}`;
}

async function royalMailRequest<T>(
  path: string,
  options: RequestInit = {},
  apiKey?: string
): Promise<T> {
  const key = apiKey || process.env.ROYAL_MAIL_API_KEY || process.env.RM_API_KEY;

  if (!key) {
    throw new RoyalMailError("ROYAL_MAIL_API_KEY is not configured", 500);
  }

  const authHeader = getAuthHeader(key);

  const response = await fetch(`${ROYAL_MAIL_API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers || {}),
    },
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type") || "";

  let data: unknown;

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    let errMsg = `Royal Mail API error (${response.status})`;
    if (typeof data === "object" && data !== null) {
      const obj = data as any;
      if (Array.isArray(obj.errors) && obj.errors.length > 0) {
        errMsg = obj.errors.map((e: any) => e.message || e.code || JSON.stringify(e)).join(' | ');
      } else if (Array.isArray(obj.failedOrders) && obj.failedOrders.length > 0) {
        const failedErrs: string[] = [];
        obj.failedOrders.forEach((f: any) => {
          if (Array.isArray(f.errors)) {
            f.errors.forEach((e: any) => failedErrs.push(e.message || e.code || JSON.stringify(e)));
          }
        });
        if (failedErrs.length > 0) errMsg = failedErrs.join(' | ');
      } else if (obj.message) {
        errMsg = obj.message;
      } else {
        errMsg = JSON.stringify(obj);
      }
    } else if (typeof data === "string" && data.length > 0) {
      errMsg = data;
    }
    throw new RoyalMailError(errMsg, response.status, data);
  }

  return data as T;
}

/**
 * Check that the live Click & Drop API credentials work.
 * This does NOT create a shipment.
 */
export async function checkRoyalMailConnection(apiKey?: string) {
  return royalMailRequest<unknown>(
    "/orders?pageSize=1",
    {
      method: "GET",
    },
    apiKey
  );
}

export interface RoyalMailAddress {
  fullName: string;
  companyName?: string;
  addressLine1: string;
  addressLine2?: string;
  addressLine3?: string;
  city: string;
  county?: string;
  postcode: string;
  countryCode: string;
}

export interface RoyalMailRecipient {
  address: RoyalMailAddress;
  phoneNumber?: string;
  emailAddress?: string;
  addressBookReference?: string;
}

export interface RoyalMailSender {
  tradingName: string;
  phoneNumber?: string;
  emailAddress?: string;
}

export interface RoyalMailPackageContent {
  name: string;
  SKU?: string;
  ReferenceId?: string;
  ContentsPieceURL?: string;
  quantity: number;
  unitValue: number;
  unitWeightInGrams: number;
  customsDescription?: string;
  extendedCustomsDescription?: string;
  customsCode?: string;
  originCountryCode?: string;
  customsDeclarationCategory?: string;
  requiresExportLicence?: boolean;
  stockLocation?: string;
  useOriginPreference?: boolean;
  supplementaryUnits?: string;
  licenseNumber?: string;
  certificateNumber?: string;
}

export interface RoyalMailPackage {
  weightInGrams: number;
  packageFormatIdentifier: string;

  customPackageFormatIdentifier?: string;

  dimensions?: {
    heightInMms: number;
    widthInMms: number;
    depthInMms: number;
  };

  contents?: RoyalMailPackageContent[];
}

export interface RoyalMailPostageDetails {
  sendNotificationsTo?: "sender" | "recipient" | "none";

  serviceCode: string;
  serviceRegisterCode?: string;

  consequentialLoss?: number;

  receiveEmailNotification?: boolean;
  receiveSmsNotification?: boolean;

  guaranteedSaturdayDelivery?: boolean;
  requestSignatureUponDelivery?: boolean;

  isLocalCollect?: boolean;

  safePlace?: string;

  department?: string;

  AIRNumber?: string;

  IOSSNumber?: string;

  requiresExportLicense?: boolean;

  commercialInvoiceNumber?: string;

  commercialInvoiceDate?: string;

  recipientEoriNumber?: string;
}

export interface CreateRoyalMailOrderRequest {
  orderReference: string;

  isRecipientABusiness?: boolean;

  recipient: RoyalMailRecipient;

  sender: RoyalMailSender;

  billing?: {
    address: RoyalMailAddress;
    phoneNumber?: string;
    emailAddress?: string;
  };

  packages: RoyalMailPackage[];

  orderDate?: string;

  plannedDespatchDate?: string;

  specialInstructions?: string;

  subtotal?: number;

  shippingCostCharged?: number;

  otherCosts?: number;

  customsDutyCosts?: number;

  total?: number;

  currencyCode?: string;

  deliveryTerm?: string;

  postageDetails: RoyalMailPostageDetails;

  tags?: {
    key: string;
    value: string;
  }[];

  label?: {
    includeLabelInResponse?: boolean;
    includeCN?: boolean;
    includeReturnsLabel?: boolean;
  };

  orderTax?: number;

  containsDangerousGoods?: boolean;

  dangerousGoodsUnCode?: string;

  dangerousGoodsDescription?: number;

  dangerousGoodsQuantity?: number;

  importer?: Record<string, unknown>;
}

export interface CreateRoyalMailResponse {
  successCount: number;
  errorsCount: number;

  createdOrders: Array<{
    orderIdentifier: number;
    orderReference: string;
    createdOn: string;
    printedOn?: string;
    manifestedOn?: string;
    shippedOn?: string;
    trackingNumber?: string;

    packages?: Array<{
      packageNumber: number;
      trackingNumber?: string;
    }>;

    label?: string;

    labelErrors?: Array<{
      message: string;
      code: string;
    }>;

    generatedDocuments?: string[];
  }>;

  failedOrders?: Array<{
    order: unknown;
    errors?: Array<{
      code: string;
      message: string;
    }>;
  }>;
}

/**
 * Create one or more Click & Drop orders.
 */
export async function createRoyalMailOrders(
  orders: CreateRoyalMailOrderRequest[],
  apiKey?: string
) {
  return royalMailRequest<CreateRoyalMailResponse>(
    "/orders",
    {
      method: "POST",
      body: JSON.stringify({
        items: orders,
      }),
    },
    apiKey
  );
}

/**
 * Retrieve one order.
 */
export async function getRoyalMailOrder(
  identifier: string | number,
  apiKey?: string
) {
  const encoded =
    typeof identifier === "number"
      ? String(identifier)
      : `"${encodeURIComponent(identifier)}"`;

  return royalMailRequest(
    `/orders/${encoded}`,
    {
      method: "GET",
    },
    apiKey
  );
}

/**
 * Retrieve a label PDF.
 */
export async function getRoyalMailLabel(
  identifier: string | number,
  options?: {
    includeReturnsLabel?: boolean;
    includeCN?: boolean;
  },
  apiKey?: string
) {
  const key = apiKey || process.env.ROYAL_MAIL_API_KEY || process.env.RM_API_KEY;

  if (!key) {
    throw new RoyalMailError("ROYAL_MAIL_API_KEY is not configured", 500);
  }

  const encoded =
    typeof identifier === "number"
      ? String(identifier)
      : `"${encodeURIComponent(identifier)}"`;

  const params = new URLSearchParams();

  params.set("documentType", "postageLabel");

  params.set(
    "includeReturnsLabel",
    String(options?.includeReturnsLabel ?? false)
  );

  if (options?.includeCN !== undefined) {
    params.set("includeCN", String(options.includeCN));
  }

  const authHeader = getAuthHeader(key);

  const response = await fetch(
    `${ROYAL_MAIL_API_URL}/orders/${encoded}/label?${params}`,
    {
      method: "GET",
      headers: {
        Authorization: authHeader,
        Accept: "application/pdf",
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const text = await response.text();

    throw new RoyalMailError(
      `Unable to retrieve Royal Mail label: ${response.status}`,
      response.status,
      text
    );
  }

  return response.arrayBuffer();
}

/**
 * Mark an order as dispatched.
 */
export async function markRoyalMailOrderDispatched(
  identifier: string | number,
  apiKey?: string
) {
  const item =
    typeof identifier === "number"
      ? {
          orderIdentifier: identifier,
          status: "despatched",
        }
      : {
          orderReference: identifier,
          status: "despatched",
        };

  return royalMailRequest(
    "/orders/status",
    {
      method: "PUT",
      body: JSON.stringify({
        items: [item],
      }),
    },
    apiKey
  );
}

// Backward compatibility exports
export type RoyalMailOrderPayload = CreateRoyalMailOrderRequest;
export type RoyalMailCreateResponse = CreateRoyalMailResponse;

export async function createOrder(payload: any, apiKey: string) {
  const item = Array.isArray(payload) ? payload : [payload];
  return createRoyalMailOrders(item, apiKey);
}

export async function getOrders(apiKey: string, params: Record<string, string | number> = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => query.append(k, String(v)));
  const url = `/orders${query.toString() ? `?${query.toString()}` : ''}`;
  return royalMailRequest(url, { method: "GET" }, apiKey);
}

export async function getOrderByReference(reference: string, apiKey: string) {
  return getRoyalMailOrder(reference, apiKey);
}

export async function cancelOrder(reference: string, apiKey: string) {
  const encoded = `"${encodeURIComponent(reference)}"`;
  return royalMailRequest(`/orders/${encoded}`, { method: "DELETE" }, apiKey);
}

export async function getApiVersion(apiKey: string) {
  return royalMailRequest("/version", { method: "GET" }, apiKey);
}
