/**
 * Screen-level Error Boundary wrapper with routing support
 * Use this to wrap individual screens for granular error handling
 */
import React, { ReactNode, useCallback } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { ErrorBoundary } from './ErrorBoundary';

interface ScreenErrorBoundaryProps {
  children: ReactNode;
  /** Name of the screen for logging and display purposes */
  screenName: string;
  /** Custom fallback component */
  fallback?: ReactNode;
  /** Whether to show the "Go Back" button (default: true for modals, based on route for tabs) */
  showGoBack?: boolean;
  /** Callback when an error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

/**
 * A screen-aware error boundary that integrates with expo-router
 *
 * Usage:
 * ```tsx
 * export default function MyScreen() {
 *   return (
 *     <ScreenErrorBoundary screenName="My Screen">
 *       <MyScreenContent />
 *     </ScreenErrorBoundary>
 *   );
 * }
 * ```
 */
export function ScreenErrorBoundary({
  children,
  screenName,
  fallback,
  showGoBack,
  onError,
}: ScreenErrorBoundaryProps) {
  const router = useRouter();
  const segments = useSegments();

  // Determine if we can go back based on navigation state
  // Modals and deep screens can go back, tabs typically cannot
  const canGoBack = useCallback(() => {
    if (showGoBack !== undefined) return showGoBack;
    // If we're in a modal or have navigation history, show go back
    return router.canGoBack();
  }, [router, showGoBack]);

  const handleGoBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      // Navigate to home if we can't go back
      router.replace('/');
    }
  }, [router]);

  const handleError = useCallback(
    (error: Error, errorInfo: React.ErrorInfo) => {
      // Log with screen context in development
      if (__DEV__) {
        console.error(`[${screenName}] Error caught by ScreenErrorBoundary:`, {
          error: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          route: segments.join('/'),
        });
      }

      // Call custom error handler if provided
      onError?.(error, errorInfo);
    },
    [screenName, segments, onError]
  );

  return (
    <ErrorBoundary
      screenName={screenName}
      fallback={fallback}
      onGoBack={canGoBack() ? handleGoBack : undefined}
      onError={handleError}
    >
      {children}
    </ErrorBoundary>
  );
}
