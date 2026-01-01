import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { colors, spacing, borderRadius } from '@/src/theme';
import { useConnectionStore } from '@/src/stores';
import { pairWithDesktop, pingDesktop } from '@/src/api/client';
import { ScreenErrorBoundary } from '@/src/components/ScreenErrorBoundary';

type Tab = 'qr' | 'manual';

// Validation helpers
const VALID_PORT_MIN = 1;
const VALID_PORT_MAX = 65535;
const PAIRING_CODE_LENGTH = 6;

// IPv4 pattern for local network addresses
const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

// Allowed local network ranges (private IPs only)
const LOCAL_NETWORK_RANGES = [
  { start: [10, 0, 0, 0], end: [10, 255, 255, 255] },      // 10.0.0.0/8
  { start: [172, 16, 0, 0], end: [172, 31, 255, 255] },    // 172.16.0.0/12
  { start: [192, 168, 0, 0], end: [192, 168, 255, 255] },  // 192.168.0.0/16
  { start: [127, 0, 0, 0], end: [127, 255, 255, 255] },    // 127.0.0.0/8 (localhost)
];

function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= VALID_PORT_MIN && port <= VALID_PORT_MAX;
}

function isValidPairingCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

function isLocalNetworkIP(host: string): boolean {
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
        // Not in range, but need to check if earlier octet was less than end
        if (i > 0 && octets[i - 1] > range.start[i - 1] && octets[i - 1] < range.end[i - 1]) {
          continue;
        }
        return false;
      }
    }
    return true;
  });
}

function validatePairingData(host: string, port: number, code: string): string | null {
  if (!isLocalNetworkIP(host)) {
    return 'Invalid host address. Only local network IPs are allowed (192.168.x.x, 10.x.x.x, 172.16-31.x.x).';
  }

  if (!isValidPort(port)) {
    return `Invalid port. Port must be between ${VALID_PORT_MIN} and ${VALID_PORT_MAX}.`;
  }

  if (!isValidPairingCode(code)) {
    return 'Invalid pairing code. Code must be exactly 6 digits.';
  }

  return null;
}

function ConnectModalContent() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('qr');
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualHost, setManualHost] = useState('');
  const [manualPort, setManualPort] = useState('8765');
  const [isConnecting, setIsConnecting] = useState(false);

  const { connection, saveDevice, clearDevice, setStatus } = useConnectionStore();

  // Handle QR code scan
  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    try {
      // Parse wynter://pair?code=123456&host=192.168.1.x&port=8765
      const url = new URL(data);
      if (url.protocol !== 'wynter:' || url.hostname !== 'pair') {
        throw new Error('Invalid QR code');
      }

      const code = url.searchParams.get('code');
      const host = url.searchParams.get('host');
      const portStr = url.searchParams.get('port');

      if (!code || !host || !portStr) {
        throw new Error('Invalid QR code data');
      }

      const port = parseInt(portStr, 10);
      if (isNaN(port)) {
        throw new Error('Invalid port number');
      }

      // Validate all pairing data
      const validationError = validatePairingData(host, port, code);
      if (validationError) {
        Alert.alert('Invalid QR Code', validationError);
        setScanned(false);
        return;
      }

      await connectWithCode(host, port, code);
    } catch (error) {
      Alert.alert('Invalid QR Code', 'Please scan a valid wynter-code pairing QR code.');
      setScanned(false);
    }
  };

  // Connect with pairing code
  const connectWithCode = async (host: string, port: number, code: string) => {
    setIsConnecting(true);
    setStatus('connecting');

    try {
      // First check if desktop is reachable
      const isReachable = await pingDesktop(host, port);
      if (!isReachable) {
        throw new Error('Desktop not reachable. Make sure you are on the same network.');
      }

      // Pair with desktop
      const response = await pairWithDesktop(host, port, code);

      // Save device
      await saveDevice({
        id: response.device.id,
        name: response.device.name,
        host,
        port,
        token: response.token,
        pairedAt: new Date().toISOString(),
      });

      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to connect';
      Alert.alert('Connection Failed', message);
      setStatus('error', message);
    } finally {
      setIsConnecting(false);
    }
  };

  // Handle manual connect
  const handleManualConnect = () => {
    const host = manualHost.trim();
    const code = manualCode.trim();
    const port = parseInt(manualPort, 10) || 8765;

    if (!host || !code) {
      Alert.alert('Missing Info', 'Please enter both host IP and pairing code.');
      return;
    }

    // Validate all pairing data
    const validationError = validatePairingData(host, port, code);
    if (validationError) {
      Alert.alert('Invalid Input', validationError);
      return;
    }

    connectWithCode(host, port, code);
  };

  // Disconnect
  const handleDisconnect = async () => {
    Alert.alert('Disconnect', 'Are you sure you want to disconnect from this device?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          await clearDevice();
          router.back();
        },
      },
    ]);
  };

  // If connected, show device info
  if (connection.device) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
            <FontAwesome name="close" size={20} color={colors.text.secondary} />
          </TouchableOpacity>
          <Text style={styles.title}>Connection</Text>
        </View>

        <View style={styles.connectedCard}>
          <View style={styles.connectedIcon}>
            <FontAwesome name="desktop" size={32} color={colors.accent.green} />
          </View>
          <Text style={styles.connectedTitle}>Connected</Text>
          <Text style={styles.deviceName}>{connection.device.name}</Text>
          <Text style={styles.deviceInfo}>
            {connection.device.host}:{connection.device.port}
          </Text>
          <Text style={styles.pairedAt}>
            Paired {new Date(connection.device.pairedAt).toLocaleDateString()}
          </Text>
        </View>

        <TouchableOpacity style={styles.disconnectButton} onPress={handleDisconnect}>
          <FontAwesome name="unlink" size={16} color={colors.accent.red} />
          <Text style={styles.disconnectText}>Disconnect Device</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
            <FontAwesome name="close" size={20} color={colors.text.secondary} />
          </TouchableOpacity>
          <Text style={styles.title}>Connect to Desktop</Text>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, tab === 'qr' && styles.tabActive]}
            onPress={() => setTab('qr')}
          >
            <FontAwesome
              name="qrcode"
              size={16}
              color={tab === 'qr' ? colors.accent.purple : colors.text.muted}
            />
            <Text style={[styles.tabText, tab === 'qr' && styles.tabTextActive]}>
              Scan QR
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'manual' && styles.tabActive]}
            onPress={() => setTab('manual')}
          >
            <FontAwesome
              name="keyboard-o"
              size={16}
              color={tab === 'manual' ? colors.accent.purple : colors.text.muted}
            />
            <Text style={[styles.tabText, tab === 'manual' && styles.tabTextActive]}>
              Enter Code
            </Text>
          </TouchableOpacity>
        </View>

        {/* QR Scanner */}
        {tab === 'qr' && (
          <View style={styles.qrContainer}>
            {!permission?.granted ? (
              <View style={styles.permissionCard}>
                <FontAwesome name="camera" size={48} color={colors.text.muted} />
                <Text style={styles.permissionTitle}>Camera Access Required</Text>
                <Text style={styles.permissionText}>
                  Allow camera access to scan the QR code shown in wynter-code desktop.
                </Text>
                <TouchableOpacity style={styles.button} onPress={requestPermission}>
                  <Text style={styles.buttonText}>Allow Camera</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.cameraContainer}>
                  <CameraView
                    style={styles.camera}
                    barcodeScannerSettings={{
                      barcodeTypes: ['qr'],
                    }}
                    onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                  />
                  <View style={styles.cameraOverlay}>
                    <View style={styles.scanFrame} />
                  </View>
                </View>
                <Text style={styles.scanHint}>
                  Scan the QR code from Desktop Settings &gt; Mobile Companion
                </Text>
                {scanned && (
                  <TouchableOpacity
                    style={styles.rescanButton}
                    onPress={() => setScanned(false)}
                  >
                    <Text style={styles.rescanText}>Scan Again</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}

        {/* Manual Entry */}
        {tab === 'manual' && (
          <View style={styles.manualContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Desktop IP Address</Text>
              <TextInput
                style={styles.input}
                placeholder="192.168.1.100"
                placeholderTextColor={colors.text.muted}
                value={manualHost}
                onChangeText={setManualHost}
                keyboardType="numeric"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Port</Text>
              <TextInput
                style={styles.input}
                placeholder="8765"
                placeholderTextColor={colors.text.muted}
                value={manualPort}
                onChangeText={setManualPort}
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Pairing Code</Text>
              <TextInput
                style={styles.input}
                placeholder="123456"
                placeholderTextColor={colors.text.muted}
                value={manualCode}
                onChangeText={setManualCode}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, isConnecting && styles.buttonDisabled]}
              onPress={handleManualConnect}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <ActivityIndicator color={colors.bg.primary} />
              ) : (
                <Text style={styles.buttonText}>Connect</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.helpText}>
              Find the pairing code in Desktop Settings &gt; Mobile Companion
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  content: {
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.xs,
    marginBottom: spacing.xl,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  tabActive: {
    backgroundColor: colors.bg.card,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.muted,
  },
  tabTextActive: {
    color: colors.accent.purple,
  },
  qrContainer: {
    alignItems: 'center',
  },
  cameraContainer: {
    width: 280,
    height: 280,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    backgroundColor: colors.bg.secondary,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: 200,
    height: 200,
    borderWidth: 2,
    borderColor: colors.accent.purple,
    borderRadius: borderRadius.lg,
  },
  scanHint: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  rescanButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  rescanText: {
    fontSize: 14,
    color: colors.accent.blue,
    fontWeight: '500',
  },
  permissionCard: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.xl,
    gap: spacing.md,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  permissionText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  manualContainer: {
    gap: spacing.lg,
  },
  inputGroup: {
    gap: spacing.sm,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  input: {
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.accent.purple + '15',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent.purple + '50',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.accent.purple,
  },
  helpText: {
    fontSize: 13,
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  connectedCard: {
    alignItems: 'center',
    backgroundColor: colors.bg.secondary,
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.xl,
  },
  connectedIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accent.green + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  connectedTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.accent.green,
    marginBottom: spacing.sm,
  },
  deviceName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  deviceInfo: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  pairedAt: {
    fontSize: 12,
    color: colors.text.muted,
  },
  disconnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.accent.red + '15',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.accent.red + '30',
    gap: spacing.sm,
  },
  disconnectText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.accent.red,
  },
});

export default function ConnectModal() {
  return (
    <ScreenErrorBoundary screenName="Connect">
      <ConnectModalContent />
    </ScreenErrorBoundary>
  );
}
