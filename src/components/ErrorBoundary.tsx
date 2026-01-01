/**
 * Error Boundary component for catching React errors
 */
import React, { Component, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { colors, spacing, borderRadius } from '../theme';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** Name of the screen for logging purposes */
  screenName?: string;
  /** Callback when user presses "Go Back" - if provided, shows Go Back button */
  onGoBack?: () => void;
  /** Callback when an error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo });

    // Log in development mode
    if (__DEV__) {
      const screenInfo = this.props.screenName ? ` in ${this.props.screenName}` : '';
      console.error(`ErrorBoundary caught error${screenInfo}:`, error, errorInfo);
    }

    // Call optional error callback
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleGoBack = (): void => {
    // Reset error state first
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    // Then navigate back
    this.props.onGoBack?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <View style={styles.iconContainer}>
            <FontAwesome name="exclamation-triangle" size={48} color={colors.accent.red} />
          </View>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            {this.props.screenName
              ? `An error occurred in ${this.props.screenName}. Please try again.`
              : 'The app encountered an unexpected error. Please try again.'}
          </Text>

          {__DEV__ && this.state.error && (
            <ScrollView style={styles.errorBox}>
              <Text style={styles.errorTitle}>{this.state.error.name}</Text>
              <Text style={styles.errorText}>{this.state.error.message}</Text>
              {this.state.errorInfo && (
                <Text style={styles.stackText}>
                  {this.state.errorInfo.componentStack}
                </Text>
              )}
            </ScrollView>
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry}>
              <FontAwesome name="refresh" size={16} color={colors.bg.primary} />
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>

            {this.props.onGoBack && (
              <TouchableOpacity style={styles.backButton} onPress={this.handleGoBack}>
                <FontAwesome name="arrow-left" size={16} color={colors.accent.purple} />
                <Text style={styles.backText}>Go Back</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.bg.primary,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.accent.red + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
    maxWidth: 300,
    paddingHorizontal: spacing.md,
  },
  errorBox: {
    maxHeight: 200,
    width: '100%',
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent.red,
    marginBottom: spacing.xs,
  },
  errorText: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  stackText: {
    fontSize: 11,
    color: colors.text.muted,
    fontFamily: 'monospace',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent.purple,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  retryText: {
    color: colors.bg.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.secondary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.accent.purple + '50',
  },
  backText: {
    color: colors.accent.purple,
    fontSize: 16,
    fontWeight: '600',
  },
});
