/**
 * Haptic feedback utilities for iOS
 */
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Light tap for selections, toggles
 */
export async function lightTap(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Ignore errors on unsupported devices
  }
}

/**
 * Medium tap for button presses
 */
export async function mediumTap(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // Ignore errors
  }
}

/**
 * Heavy tap for destructive actions
 */
export async function heavyTap(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch {
    // Ignore errors
  }
}

/**
 * Success feedback
 */
export async function success(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Ignore errors
  }
}

/**
 * Warning feedback
 */
export async function warning(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {
    // Ignore errors
  }
}

/**
 * Error feedback
 */
export async function error(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {
    // Ignore errors
  }
}

/**
 * Selection changed feedback (for pickers, sliders)
 */
export async function selectionChanged(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    await Haptics.selectionAsync();
  } catch {
    // Ignore errors
  }
}
