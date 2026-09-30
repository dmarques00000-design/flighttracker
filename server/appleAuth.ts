import {
  createHmac,
  createPublicKey,
  createVerify,
  timingSafeEqual,
} from "node:crypto";

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_CLIENT_ID = "com.logbookapp";
const APPLE_KEYS_URL = "https://appleid.apple.com/auth/keys";
const SESSION_ALGORITHM = "HS256";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

type AppleClaims = {
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  sub: string;
  nonce?: string;
  email?: string;
  email_verified?: boolean | string;
};

type Jwk = {
  kty: string;
  kid: string;
  use?: string;
  alg?: string;
  crv?: string;
  x?: string;
  y?: string;
};

let cachedAppleKeys: { expiresAt: number; keys: Jwk[] } | null = null;

function base64urlDecode(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

function base64urlEncode(value: Buffer | string): string {
  return Buffer.from(value).toString("base64url");
}

function parseJwtPart<T>(value: string): T {
  return JSON.parse(base64urlDecode(value).toString("utf8")) as T;
}

async function getAppleKeys(): Promise<Jwk[]> {
  if (cachedAppleKeys && cachedAppleKeys.expiresAt > Date.now()) {
    return cachedAppleKeys.keys;
  }

  const response = await fetch(APPLE_KEYS_URL);
  if (!response.ok) {
    throw new Error(`Apple public key request failed: ${response.status}`);
  }

  const body = (await response.json()) as { keys?: Jwk[] };
  if (!Array.isArray(body.keys) || body.keys.length === 0) {
    throw new Error("Apple public key response was empty.");
  }

  cachedAppleKeys = {
    keys: body.keys,
    expiresAt: Date.now() + 6 * 60 * 60 * 1000,
  };

  return body.keys;
}

export async function verifyAppleIdentityToken(
  identityToken: string,
  rawNonce: string,
): Promise<AppleClaims> {
  const parts = identityToken.split(".");
  if (parts.length !== 3) throw new Error("Malformed Apple identity token.");

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = parseJwtPart<{ alg?: string; kid?: string }>(encodedHeader);
  const claims = parseJwtPart<AppleClaims>(encodedPayload);

  if (header.alg !== "ES256" || !header.kid) {
    throw new Error("Unsupported Apple identity token.");
  }

  const key = (await getAppleKeys()).find((candidate) => candidate.kid === header.kid);
  if (!key) throw new Error("Apple signing key not found.");

  const publicKey = createPublicKey({ key, format: "jwk" });
  const verifier = createVerify("sha256");
  verifier.update(`${encodedHeader}.${encodedPayload}`);
  verifier.end();

  const validSignature = verifier.verify(
    { key: publicKey, dsaEncoding: "ieee-p1363" },
    base64urlDecode(encodedSignature),
  );

  if (!validSignature) throw new Error("Invalid Apple identity token signature.");

  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== APPLE_ISSUER) throw new Error("Invalid Apple token issuer.");
  if (claims.aud !== APPLE_CLIENT_ID) throw new Error("Invalid Apple token audience.");
  if (!claims.sub) throw new Error("Apple token has no user identifier.");
  if (!Number.isFinite(claims.exp) || claims.exp <= now) {
    throw new Error("Apple identity token has expired.");
  }
  if (!Number.isFinite(claims.iat) || claims.iat > now + 60) {
    throw new Error("Apple identity token has an invalid issue time.");
  }

  const expectedNonce = createHmac("sha256", "").update(rawNonce).digest("hex");
  const suppliedNonce = claims.nonce ?? "";
  if (suppliedNonce.length !== expectedNonce.length || !timingSafeEqual(Buffer.from(suppliedNonce), Buffer.from(expectedNonce))) {
    throw new Error("Apple identity token nonce mismatch.");
  }

  return claims;
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set and contain at least 32 characters.");
  }
  return secret;
}

function signSession(header: object, payload: object): string {
  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  const input = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", getSessionSecret()).update(input).digest();
  return `${input}.${base64urlEncode(signature)}`;
}

export function createSessionToken(userId: string): string {
  const now = Math.floor(Date.now() / 1000);
  return signSession(
    { alg: SESSION_ALGORITHM, typ: "JWT" },
    { sub: userId, iat: now, exp: now + SESSION_TTL_SECONDS },
  );
}

export function verifySessionToken(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const header = parseJwtPart<{ alg?: string; typ?: string }>(encodedHeader);
    const payload = parseJwtPart<{ sub?: string; exp?: number }>(encodedPayload);

    if (header.alg !== SESSION_ALGORITHM || header.typ !== "JWT" || !payload.sub) {
      return null;
    }

    const expected = createHmac("sha256", getSessionSecret())
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest();
    const supplied = base64urlDecode(encodedSignature);

    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      return null;
    }

    if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload.sub;
  } catch {
    return null;
  }
}
