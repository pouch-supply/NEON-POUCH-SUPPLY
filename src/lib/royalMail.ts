const BASE_URL =
  process.env.RM_API_BASE_URL ||
  process.env.ROYAL_MAIL_BASE_URL ||
  'https://api.parcel.royalmail.com/api/v1';

export interface RoyalMailAddress {
  fullName: string;
  companyName?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  county?: string;
  postcode: string;
  countryCode: string;
}

export interface RoyalMailOrderPayload {
  orderReference: string;
  isRecipientABusiness?: boolean;

  recipient: {
    address: RoyalMailAddress;
    phoneNumber?: string;
    emailAddress?: string;
  };

  orderDate?: string;

  packages: Array<{
    weightInGrams: number;
    packageFormatIdentifier?: string;
    packageType?: string;
    contents?: Array<{
      name: string;
      quantity: number;
      unitValue: number;
      unitWeightInGrams?: number;
      sku?: string;
    }>;
  }>;

  postageDetails: {
    serviceCode: string;
    sendNotificationsTo?: string;
    receiveEmailNotification?: boolean;
    sendNotifications?: boolean;
  };

  label?: {
    includeLabelInResponse?: boolean;
    includeCN?: boolean;
    includeReturnsLabel?: boolean;
  };

  billing?: {
    fullName?: string;
    addressLine1?: string;
    city?: string;
    postcode?: string;
    countryCode?: string;
  };
}

export interface RoyalMailCreateResponse {
  createdOrders?: Array<{
    orderIdentifier?: number | string;
    orderReference?: string;
    trackingNumber?: string;
  }>;

  errors?: Array<{
    code?: string;
    message?: string;
  }>;

  [key: string]: unknown;
}

/**
 * Royal Mail API headers
 *
 * IMPORTANT:
 * The API key must stay on the server.
 * Never expose RM_API_KEY in client-side code.
 */
function getHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: apiKey,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

/**
 * Create an order in Royal Mail Click & Drop
 */
export async function createOrder(
  orderData: RoyalMailOrderPayload,
  apiKey: string
): Promise<RoyalMailCreateResponse> {
  if (!apiKey) {
    throw new Error('Royal Mail API key is missing.');
  }

  const response = await fetch(`${BASE_URL}/Orders`, {
    method: 'POST',
    headers: getHeaders(apiKey),

    /*
     * Royal Mail expects an "items" array.
     */
    body: JSON.stringify({
      items: [orderData],
    }),
  });

  const responseText = await response.text();

  let data: RoyalMailCreateResponse = {};

  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = {
      rawResponse: responseText,
    };
  }

  if (!response.ok) {
    throw new Error(
      `Royal Mail API Error (${response.status}): ${JSON.stringify(data)}`
    );
  }

  return data;
}

/**
 * Get orders from Royal Mail
 */
export async function getOrders(
  apiKey: string,
  params: Record<string, string | number> = {}
): Promise<unknown> {
  if (!apiKey) {
    throw new Error('Royal Mail API key is missing.');
  }

  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    query.append(key, String(value));
  });

  const url = `${BASE_URL}/Orders${
    query.toString() ? `?${query.toString()}` : ''
  }`;

  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(apiKey),
  });

  const responseText = await response.text();

  let data: unknown;

  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = responseText;
  }

  if (!response.ok) {
    throw new Error(
      `Royal Mail API Error (${response.status}): ${JSON.stringify(data)}`
    );
  }

  return data;
}

/**
 * Get a specific Royal Mail order
 *
 * Royal Mail supports order identifiers/references
 * through /Orders/{orderIdentifiers}
 */
export async function getOrderByReference(
  reference: string,
  apiKey: string
): Promise<unknown> {
  if (!apiKey) {
    throw new Error('Royal Mail API key is missing.');
  }

  const encodedReference = encodeURIComponent(`"${reference}"`);

  const response = await fetch(`${BASE_URL}/Orders/${encodedReference}`, {
    method: 'GET',
    headers: getHeaders(apiKey),
  });

  const responseText = await response.text();

  let data: unknown;

  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = responseText;
  }

  if (!response.ok) {
    throw new Error(
      `Royal Mail API Error (${response.status}): ${JSON.stringify(data)}`
    );
  }

  return data;
}

/**
 * Cancel / delete a Royal Mail order
 */
export async function cancelOrder(
  reference: string,
  apiKey: string
): Promise<unknown> {
  if (!apiKey) {
    throw new Error('Royal Mail API key is missing.');
  }

  const encodedReference = encodeURIComponent(`"${reference}"`);

  const response = await fetch(`${BASE_URL}/Orders/${encodedReference}`, {
    method: 'DELETE',
    headers: getHeaders(apiKey),
  });

  const responseText = await response.text();

  let data: unknown;

  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = responseText;
  }

  if (!response.ok) {
    throw new Error(
      `Royal Mail API Error (${response.status}): ${JSON.stringify(data)}`
    );
  }

  return data;
}

/**
 * Get Royal Mail API version
 */
export async function getApiVersion(
  apiKey: string
): Promise<unknown> {
  if (!apiKey) {
    throw new Error('Royal Mail API key is missing.');
  }

  const response = await fetch(`${BASE_URL}/version`, {
    method: 'GET',
    headers: getHeaders(apiKey),
  });

  const responseText = await response.text();

  let data: unknown;

  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = responseText;
  }

  if (!response.ok) {
    throw new Error(
      `Royal Mail API Error (${response.status}): ${JSON.stringify(data)}`
    );
  }

  return data;
}
