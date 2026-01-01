/**
 * Cryptographic utilities for request signing and verification
 *
 * Security Notes:
 * - Request signing provides integrity verification and replay protection
 * - For production apps, consider implementing native SSL pinning:
 *   - iOS: Use NSURLSession with custom URLSessionDelegate
 *   - Android: Use OkHttp with CertificatePinner
 *   - Libraries: react-native-ssl-pinning or TrustKit
 *
 * Note: This module uses expo-crypto which requires native module linking.
 * For Expo Go, the crypto functions will throw an error. Use validation.ts
 * for non-crypto validation functions that work without native modules.
 */

// Lazy load expo-crypto to avoid crash on import
let Crypto: typeof import('expo-crypto') | null = null;

async function getCrypto(): Promise<typeof import('expo-crypto')> {
  if (!Crypto) {
    try {
      Crypto = await import('expo-crypto');
    } catch (error) {
      throw new Error(
        'ExpoCrypto native module not available. ' +
        'Run `npx expo install expo-crypto` and rebuild the app, ' +
        'or use validation.ts for non-crypto validation functions.'
      );
    }
  }
  return Crypto;
}

/**
 * Generate a timestamp for request signing
 */
export function getTimestamp(): number {
  return Date.now();
}

/**
 * Generate a nonce for request uniqueness
 */
export async function generateNonce(): Promise<string> {
  const crypto = await getCrypto();
  const randomBytes = await crypto.getRandomBytesAsync(16);
  return Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Create a signature for request verification
 * Signs: method + url + timestamp + nonce + body
 */
export async function signRequest(params: {
  method: string;
  url: string;
  timestamp: number;
  nonce: string;
  body?: string;
  token: string;
}): Promise<string> {
  const crypto = await getCrypto();
  const { method, url, timestamp, nonce, body, token } = params;

  // Create the signing payload
  const payload = [
    method.toUpperCase(),
    url,
    timestamp.toString(),
    nonce,
    body || '',
  ].join('\n');

  // Use SHA-256 to create signature with token as key material
  // Note: expo-crypto digestStringAsync doesn't support HMAC directly,
  // so we concatenate token and payload for a simple signature scheme
  const signatureInput = `${token}:${payload}`;
  const signature = await crypto.digestStringAsync(
    crypto.CryptoDigestAlgorithm.SHA256,
    signatureInput
  );

  return signature;
}

/**
 * Verify a response signature (optional, if server signs responses)
 */
export async function verifyResponseSignature(params: {
  body: string;
  signature: string;
  timestamp: number;
  token: string;
}): Promise<boolean> {
  const crypto = await getCrypto();
  const { body, signature, timestamp, token } = params;

  // Check if timestamp is within acceptable range (5 minutes)
  const now = Date.now();
  const timeDiff = Math.abs(now - timestamp);
  if (timeDiff > 5 * 60 * 1000) {
    return false;
  }

  // Recreate signature
  const signatureInput = `${token}:response:${timestamp}:${body}`;
  const expectedSignature = await crypto.digestStringAsync(
    crypto.CryptoDigestAlgorithm.SHA256,
    signatureInput
  );

  return signature === expectedSignature;
}
