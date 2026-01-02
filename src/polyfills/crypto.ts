/**
 * Polyfill for crypto.getRandomValues in React Native
 * Must be imported before any crypto libraries (noble-ciphers, noble-curves, etc.)
 */
import * as ExpoCrypto from 'expo-crypto';

// Polyfill crypto.getRandomValues for React Native
if (typeof globalThis.crypto === 'undefined') {
  (globalThis as unknown as { crypto: Partial<Crypto> }).crypto = {};
}

if (typeof globalThis.crypto.getRandomValues === 'undefined') {
  globalThis.crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
    if (array === null) {
      throw new TypeError('Expected ArrayBufferView, got null');
    }

    if (!(array instanceof Uint8Array)) {
      // Handle other TypedArray types by creating a Uint8Array view
      const uint8View = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
      const randomBytes = ExpoCrypto.getRandomBytes(uint8View.length);
      uint8View.set(randomBytes);
      return array;
    }

    const randomBytes = ExpoCrypto.getRandomBytes(array.length);
    array.set(randomBytes);
    return array;
  };
}
