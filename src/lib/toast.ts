/**
 * Simple toast notification system using React Native Alert
 * For a more advanced solution, consider react-native-toast-message
 */
import { Alert, Platform } from 'react-native';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastOptions {
  title?: string;
  message: string;
  type?: ToastType;
  duration?: number;
}

/**
 * Show a toast notification
 * Uses Alert on iOS for now (could be replaced with a custom toast component)
 */
export function showToast(options: ToastOptions): void {
  const { title, message, type = 'info' } = options;

  const titles: Record<ToastType, string> = {
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
    info: 'Info',
  };

  const displayTitle = title || titles[type];

  // For now, use Alert - could be replaced with a custom toast component
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    Alert.alert(displayTitle, message, [{ text: 'OK' }]);
  } else {
    console.log(`[${type.toUpperCase()}] ${displayTitle}: ${message}`);
  }
}

/**
 * Show success toast
 */
export function showSuccess(message: string, title?: string): void {
  showToast({ message, title, type: 'success' });
}

/**
 * Show error toast
 */
export function showError(message: string, title?: string): void {
  showToast({ message, title, type: 'error' });
}

/**
 * Show warning toast
 */
export function showWarning(message: string, title?: string): void {
  showToast({ message, title, type: 'warning' });
}

/**
 * Show info toast
 */
export function showInfo(message: string, title?: string): void {
  showToast({ message, title, type: 'info' });
}
