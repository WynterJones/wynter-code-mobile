/**
 * End-to-end encryption for relay mode communication
 *
 * Uses X25519 for key exchange and XChaCha20-Poly1305 for encryption.
 * This ensures the relay server only sees opaque encrypted blobs.
 *
 * Security:
 * - X25519 key exchange for forward secrecy
 * - XChaCha20-Poly1305 AEAD for authenticated encryption
 * - Random 24-byte nonces (XChaCha allows safe random nonces)
 * - HKDF for key derivation
 *
 * @see https://github.com/paulmillr/noble-ciphers
 * @see https://github.com/paulmillr/noble-curves
 */

import { x25519 } from '@noble/curves/ed25519.js';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { randomBytes } from '@noble/ciphers/utils.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';

// Key derivation info string for HKDF
const HKDF_INFO = new TextEncoder().encode('wynter-relay-v1');

// Nonce size for XChaCha20-Poly1305
const NONCE_SIZE = 24;

export interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface EncryptedEnvelope {
  sender_id: string;   // Device ID of sender (for relay routing)
  recipient_id: string; // Device ID of recipient (for relay routing)
  timestamp: number;   // Unix timestamp in seconds
  nonce: string;       // Base64 encoded 24-byte nonce
  ciphertext: string;  // Base64 encoded ciphertext with auth tag
}

/**
 * Generate an X25519 key pair for ECDH key exchange
 */
export function generateKeyPair(): KeyPair {
  const privateKey = x25519.utils.randomSecretKey();
  const publicKey = x25519.getPublicKey(privateKey);
  return { publicKey, privateKey };
}

/**
 * Derive a shared secret using X25519 ECDH
 * Then derive an encryption key using HKDF-SHA256
 */
export function deriveSharedKey(
  privateKey: Uint8Array,
  peerPublicKey: Uint8Array
): Uint8Array {
  // Perform X25519 key exchange
  const sharedSecret = x25519.getSharedSecret(privateKey, peerPublicKey);

  // Derive encryption key using HKDF
  // 32 bytes for XChaCha20-Poly1305 key
  const encryptionKey = hkdf(sha256, sharedSecret, undefined, HKDF_INFO, 32);

  return encryptionKey;
}

/**
 * Encrypt a message using XChaCha20-Poly1305
 * Returns an envelope with base64-encoded nonce and ciphertext
 */
export function encrypt(
  plaintext: Uint8Array,
  key: Uint8Array,
  senderId: string,
  recipientId: string
): EncryptedEnvelope {
  // Generate random 24-byte nonce (XChaCha allows safe random nonces)
  const nonce = randomBytes(NONCE_SIZE);

  // Create cipher and encrypt
  const cipher = xchacha20poly1305(key, nonce);
  const ciphertext = cipher.encrypt(plaintext);

  return {
    sender_id: senderId,
    recipient_id: recipientId,
    timestamp: Math.floor(Date.now() / 1000),
    nonce: uint8ArrayToBase64(nonce),
    ciphertext: uint8ArrayToBase64(ciphertext),
  };
}

/**
 * Decrypt a message using XChaCha20-Poly1305
 * Takes an envelope with base64-encoded nonce and ciphertext
 */
export function decrypt(
  envelope: EncryptedEnvelope,
  key: Uint8Array
): Uint8Array {
  const nonce = base64ToUint8Array(envelope.nonce);
  const ciphertext = base64ToUint8Array(envelope.ciphertext);

  // Create cipher and decrypt
  const cipher = xchacha20poly1305(key, nonce);
  const plaintext = cipher.decrypt(ciphertext);

  return plaintext;
}

/**
 * Encrypt a JSON message for relay transmission
 */
export function encryptMessage(
  message: object,
  key: Uint8Array,
  senderId: string,
  recipientId: string
): EncryptedEnvelope {
  const plaintext = new TextEncoder().encode(JSON.stringify(message));
  return encrypt(plaintext, key, senderId, recipientId);
}

/**
 * Decrypt a JSON message from relay transmission
 */
export function decryptMessage<T = unknown>(
  envelope: EncryptedEnvelope,
  key: Uint8Array
): T {
  const plaintext = decrypt(envelope, key);
  const text = new TextDecoder().decode(plaintext);
  return JSON.parse(text) as T;
}

// ============================================================================
// Base64 utilities (standard base64, compatible with atob/btoa)
// ============================================================================

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string (useful for debugging)
 */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex string to Uint8Array
 */
export function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Export public key as base64 for QR code
 */
export function exportPublicKey(publicKey: Uint8Array): string {
  return uint8ArrayToBase64(publicKey);
}

/**
 * Import public key from base64 (from QR code)
 */
export function importPublicKey(base64: string): Uint8Array {
  return base64ToUint8Array(base64);
}
