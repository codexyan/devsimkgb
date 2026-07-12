// Autentikasi Google Sheets API via Service Account (JWT RS256 → access token).
//
// Dirancang agar berjalan DI DUA lingkungan tanpa dependensi Node:
//   • Node.js (dev, `next dev`)      — WebCrypto tersedia sebagai global sejak Node 18.
//   • Cloudflare Workers (produksi)  — hanya WebCrypto; tidak ada `crypto` Node.
//
// Alur: bentuk JWT (header.claim) → tanda tangani dengan private key service
// account (RSASSA-PKCS1-v1_5 / SHA-256) → tukar ke Google OAuth token endpoint.
// Access token di-cache di memori sampai mendekati kedaluwarsa.

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

type CachedToken = { token: string; expiresAt: number };
let cache: CachedToken | null = null;

// Koreksi selisih jam lokal terhadap waktu server Google (serverTime - localTime),
// dalam milidetik. Diisi otomatis bila token pertama ditolak karena timeframe.
// Berguna saat jam mesin dev meleset; di Cloudflare nilainya ~0.
let clockOffsetMs = 0;

function nowSeconds(): number {
  return Math.floor((Date.now() + clockOffsetMs) / 1000);
}

function getServiceAccount() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error(
      "Kredensial Google Sheets belum di-set. Butuh GOOGLE_SERVICE_ACCOUNT_EMAIL dan GOOGLE_PRIVATE_KEY di environment.",
    );
  }
  // Di file .env private key biasanya ditulis satu baris dengan escape "\n".
  const privateKey = rawKey.includes("-----BEGIN")
    ? rawKey.replace(/\\n/g, "\n")
    : rawKey;
  return { email, privateKey };
}

// --- util encoding (tanpa Buffer, agar aman di Workers) ---

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function stringToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function signJwt(email: string, privateKeyPem: string): Promise<string> {
  const now = nowSeconds();
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: email,
    scope: SCOPE,
    aud: TOKEN_ENDPOINT,
    iat: now,
    exp: now + 3540, // 59 menit; di bawah batas maksimum 60 menit Google.
  };

  const encHeader = base64UrlEncode(stringToBytes(JSON.stringify(header)));
  const encClaim = base64UrlEncode(stringToBytes(JSON.stringify(claim)));
  const signingInput = `${encHeader}.${encClaim}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    stringToBytes(signingInput) as BufferSource,
  );

  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function requestToken(assertion: string): Promise<Response> {
  return fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
}

/** Access token Google Sheets yang valid, memakai cache selama masih segar. */
export async function getAccessToken(): Promise<string> {
  if (cache && Date.now() < cache.expiresAt) return cache.token;

  const { email, privateKey } = getServiceAccount();
  let res = await requestToken(await signJwt(email, privateKey));

  if (!res.ok) {
    const body = await res.text();
    const serverDate = res.headers.get("date");
    // Kemungkinan jam lokal meleset → koreksi pakai waktu server Google, coba ulang sekali.
    if (serverDate && /invalid_grant|timeframe|iat|exp|JWT/i.test(body)) {
      clockOffsetMs = new Date(serverDate).getTime() - Date.now();
      res = await requestToken(await signJwt(email, privateKey));
      if (!res.ok) {
        const retryBody = await res.text();
        throw new Error(
          `Gagal ambil access token Google setelah koreksi jam (${res.status}): ${retryBody}`,
        );
      }
    } else {
      throw new Error(`Gagal ambil access token Google (${res.status}): ${body}`);
    }
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  // Refresh 60 detik lebih awal untuk aman. Basis Date.now() lokal (sama-sama lokal).
  cache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cache.token;
}
