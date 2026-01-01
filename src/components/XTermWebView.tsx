/**
 * XTermWebView - Full terminal emulator using xterm.js in a WebView
 * Provides real CLI experience with proper ANSI code handling
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

import { colors } from '@/src/theme';
import { writeTerminal } from '@/src/api/client';
import { wsManager, TerminalOutputUpdate } from '@/src/api/websocket';

interface XTermWebViewProps {
  ptyId: string | null;
  onReady?: () => void;
  style?: object;
}

// Catppuccin Mocha theme for xterm.js
const XTERM_THEME = {
  background: colors.bg.tertiary,
  foreground: colors.text.primary,
  cursor: colors.accent.purple,
  cursorAccent: colors.bg.tertiary,
  selectionBackground: 'rgba(203, 166, 247, 0.3)',
  black: '#45475a',
  red: '#f38ba8',
  green: '#a6e3a1',
  yellow: '#f9e2af',
  blue: '#89b4fa',
  magenta: '#cba6f7',
  cyan: '#94e2d5',
  white: '#bac2de',
  brightBlack: '#585b70',
  brightRed: '#f38ba8',
  brightGreen: '#a6e3a1',
  brightYellow: '#f9e2af',
  brightBlue: '#89b4fa',
  brightMagenta: '#cba6f7',
  brightCyan: '#94e2d5',
  brightWhite: '#a6adc8',
};

// Generate the HTML that runs xterm.js
const generateXTermHTML = () => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/css/xterm.css">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: ${colors.bg.tertiary};
    }
    #terminal {
      width: 100%;
      height: 100%;
      padding: 8px;
    }
    .xterm {
      height: 100%;
    }
    .xterm-viewport {
      overflow-y: auto !important;
    }
    /* Hide scrollbar but allow scrolling */
    .xterm-viewport::-webkit-scrollbar {
      width: 6px;
    }
    .xterm-viewport::-webkit-scrollbar-track {
      background: transparent;
    }
    .xterm-viewport::-webkit-scrollbar-thumb {
      background: ${colors.border};
      border-radius: 3px;
    }
  </style>
</head>
<body>
  <div id="terminal"></div>
  <script src="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/lib/xterm.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.10.0/lib/addon-fit.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@xterm/addon-web-links@0.11.0/lib/addon-web-links.js"></script>
  <script>
    // Initialize terminal
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '"SF Mono", "Menlo", "Monaco", "Courier New", monospace',
      theme: ${JSON.stringify(XTERM_THEME)},
      allowProposedApi: true,
      scrollback: 5000,
      convertEol: true,
      cursorStyle: 'bar',
      cursorWidth: 2,
    });

    const fitAddon = new FitAddon.FitAddon();
    const webLinksAddon = new WebLinksAddon.WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    term.open(document.getElementById('terminal'));

    // Initial fit
    setTimeout(() => {
      fitAddon.fit();
      // Notify React Native that terminal is ready
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'ready',
        cols: term.cols,
        rows: term.rows
      }));
    }, 100);

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'resize',
        cols: term.cols,
        rows: term.rows
      }));
    });
    resizeObserver.observe(document.getElementById('terminal'));

    // Send user input to React Native
    term.onData((data) => {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'input',
        data: data
      }));
    });

    // Receive output from React Native
    window.writeToTerminal = (data) => {
      term.write(data);
    };

    // Clear terminal
    window.clearTerminal = () => {
      term.clear();
    };

    // Focus terminal
    window.focusTerminal = () => {
      term.focus();
    };

    // Handle messages from React Native
    document.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'output') {
          term.write(msg.data);
        } else if (msg.type === 'clear') {
          term.clear();
        } else if (msg.type === 'focus') {
          term.focus();
        }
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    });

    // Also handle window.onmessage for iOS
    window.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'output') {
          term.write(msg.data);
        } else if (msg.type === 'clear') {
          term.clear();
        } else if (msg.type === 'focus') {
          term.focus();
        }
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };
  </script>
</body>
</html>
`;

export function XTermWebView({ ptyId, onReady, style }: XTermWebViewProps) {
  const webViewRef = useRef<WebView>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle messages from the WebView
  const handleMessage = useCallback(async (event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);

      switch (msg.type) {
        case 'ready':
          setIsReady(true);
          onReady?.();
          break;

        case 'input':
          // Send user input to the PTY
          if (ptyId && msg.data) {
            try {
              await writeTerminal(ptyId, msg.data);
            } catch (err) {
              console.error('[XTermWebView] Failed to write to terminal:', err);
            }
          }
          break;

        case 'resize':
          break;
      }
    } catch (err) {
      console.error('[XTermWebView] Failed to parse message:', err);
    }
  }, [ptyId, onReady]);

  // Listen for terminal output from WebSocket
  useEffect(() => {
    if (!ptyId || !isReady) return;

    const unsubscribe = wsManager.addHandler((update) => {
      if (update.type === 'TerminalOutput') {
        const terminalUpdate = update as TerminalOutputUpdate;
        if (terminalUpdate.pty_id === ptyId) {
          // Send output to the WebView
          webViewRef.current?.postMessage(JSON.stringify({
            type: 'output',
            data: terminalUpdate.data,
          }));
        }
      }
    });

    return unsubscribe;
  }, [ptyId, isReady]);

  // Write data to the terminal (for external use)
  const write = useCallback((data: string) => {
    webViewRef.current?.postMessage(JSON.stringify({
      type: 'output',
      data,
    }));
  }, []);

  // Clear the terminal
  const clear = useCallback(() => {
    webViewRef.current?.postMessage(JSON.stringify({
      type: 'clear',
    }));
  }, []);

  // Focus the terminal
  const focus = useCallback(() => {
    webViewRef.current?.postMessage(JSON.stringify({
      type: 'focus',
    }));
  }, []);

  const handleError = useCallback((syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    setError(nativeEvent.description || 'Failed to load terminal');
    console.error('[XTermWebView] Error:', nativeEvent);
  }, []);

  if (error) {
    return (
      <View style={[styles.container, styles.errorContainer, style]}>
        <Text style={styles.errorText}>Failed to load terminal</Text>
        <Text style={styles.errorDetail}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {!isReady && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color={colors.accent.green} />
          <Text style={styles.loadingText}>Loading terminal...</Text>
        </View>
      )}
      <WebView
        ref={webViewRef}
        source={{ html: generateXTermHTML() }}
        style={[styles.webview, !isReady && styles.hidden]}
        onMessage={handleMessage}
        onError={handleError}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        // Restrict origins to only allow the inline HTML and trusted CDN
        originWhitelist={['about:*', 'data:*']}
        // Block navigation to any external URLs
        onShouldStartLoadWithRequest={(request) => {
          // Allow initial load of inline HTML
          if (request.url.startsWith('about:') || request.url.startsWith('data:')) {
            return true;
          }
          // Allow CDN resources for xterm.js
          if (request.url.startsWith('https://cdn.jsdelivr.net/')) {
            return true;
          }
          // Block all other navigation
          return false;
        }}
        scrollEnabled={false}
        bounces={false}
        keyboardDisplayRequiresUserAction={false}
        hideKeyboardAccessoryView={false}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        startInLoadingState={false}
        cacheEnabled={true}
        // Allow keyboard input
        allowsBackForwardNavigationGestures={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.tertiary,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  hidden: {
    opacity: 0,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg.tertiary,
    gap: 8,
  },
  loadingText: {
    color: colors.text.muted,
    fontSize: 13,
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: colors.accent.red,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorDetail: {
    color: colors.text.muted,
    fontSize: 12,
    textAlign: 'center',
  },
});

export default XTermWebView;
