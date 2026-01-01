/**
 * Network validation utilities
 *
 * These functions provide security validation for network endpoints
 * without requiring native crypto modules.
 */

// Session timeout in milliseconds (15 minutes)
export const SESSION_TIMEOUT_MS = 15 * 60 * 1000;

// Token refresh threshold (refresh when less than 5 minutes remaining)
export const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

// ============================================================================
// Session Validation
// ============================================================================

/**
 * Check if a token needs refresh based on pairing timestamp
 */
export function tokenNeedsRefresh(pairedAt: string): boolean {
  const pairedTime = new Date(pairedAt).getTime();
  const now = Date.now();
  const elapsed = now - pairedTime;
  const remaining = SESSION_TIMEOUT_MS - elapsed;

  return remaining < TOKEN_REFRESH_THRESHOLD_MS;
}

/**
 * Check if session has expired
 */
export function isSessionExpired(pairedAt: string): boolean {
  const pairedTime = new Date(pairedAt).getTime();
  const now = Date.now();
  const elapsed = now - pairedTime;

  return elapsed > SESSION_TIMEOUT_MS;
}

// ============================================================================
// Hostname Validation (Defense against DNS/ARP spoofing)
// ============================================================================

// IPv4 pattern for local network addresses
const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

// Allowed local network ranges (private IPs only)
const LOCAL_NETWORK_RANGES = [
  { start: [10, 0, 0, 0], end: [10, 255, 255, 255] },      // 10.0.0.0/8
  { start: [172, 16, 0, 0], end: [172, 31, 255, 255] },    // 172.16.0.0/12
  { start: [192, 168, 0, 0], end: [192, 168, 255, 255] },  // 192.168.0.0/16
  { start: [127, 0, 0, 0], end: [127, 255, 255, 255] },    // 127.0.0.0/8 (localhost)
];

/**
 * Validate that a host is a valid local network IP address.
 * This provides defense against connecting to malicious external hosts.
 */
export function isValidLocalNetworkHost(host: string): boolean {
  const match = host.match(IPV4_PATTERN);
  if (!match) return false;

  const octets = [
    parseInt(match[1], 10),
    parseInt(match[2], 10),
    parseInt(match[3], 10),
    parseInt(match[4], 10),
  ];

  // Validate each octet is 0-255
  if (octets.some((o) => o < 0 || o > 255)) return false;

  // Check if IP is in allowed local network ranges
  return LOCAL_NETWORK_RANGES.some((range) => {
    for (let i = 0; i < 4; i++) {
      if (octets[i] < range.start[i] || octets[i] > range.end[i]) {
        // Check if this is within range due to earlier octets
        if (i > 0 && octets[i - 1] > range.start[i - 1] && octets[i - 1] < range.end[i - 1]) {
          continue;
        }
        return false;
      }
    }
    return true;
  });
}

/**
 * Validate that a port number is valid (1-65535)
 */
export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

/**
 * Validate host and port before making network requests.
 * Throws an error if validation fails.
 */
export function validateNetworkEndpoint(host: string, port: number): void {
  if (!isValidLocalNetworkHost(host)) {
    throw new Error(
      'Security Error: Invalid host address. Only local network IPs are allowed.'
    );
  }

  if (!isValidPort(port)) {
    throw new Error(
      'Security Error: Invalid port number. Port must be between 1 and 65535.'
    );
  }
}
