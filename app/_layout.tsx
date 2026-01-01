import FontAwesome from '@expo/vector-icons/FontAwesome';
import { ThemeProvider, DarkTheme } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { colors } from '@/src/theme';
import { useConnectionStore } from '@/src/stores';
import { queryClient } from '@/src/api/client';
import { ErrorBoundary } from '@/src/components/ErrorBoundary';

// Re-export for expo-router
export { ErrorBoundary };

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

// Catppuccin Mocha theme for React Navigation
const CatppuccinTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent.purple,
    background: colors.bg.primary,
    card: colors.bg.secondary,
    text: colors.text.primary,
    border: colors.border,
    notification: colors.accent.red,
  },
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  const loadSavedDevice = useConnectionStore((s) => s.loadSavedDevice);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
      loadSavedDevice();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={CatppuccinTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="modal"
            options={{
              presentation: 'modal',
              title: 'Connect'
            }}
          />
          <Stack.Screen
            name="menu"
            options={{
              presentation: 'transparentModal',
              headerShown: false,
              animation: 'fade',
            }}
          />
          <Stack.Screen
            name="farmwork"
            options={{
              title: 'Farmwork',
              headerStyle: { backgroundColor: colors.bg.secondary },
              headerTintColor: colors.text.primary,
              headerBackTitle: 'Home',
            }}
          />
          <Stack.Screen
            name="overwatch"
            options={{
              title: 'Overwatch',
              headerStyle: { backgroundColor: colors.bg.secondary },
              headerTintColor: colors.text.primary,
              headerBackTitle: 'Home',
            }}
          />
          <Stack.Screen
            name="subscriptions"
            options={{
              title: 'Subscriptions',
              headerStyle: { backgroundColor: colors.bg.secondary },
              headerTintColor: colors.text.primary,
              headerBackTitle: 'Home',
            }}
          />
          <Stack.Screen
            name="bookmarks"
            options={{
              title: 'Bookmarks',
              headerStyle: { backgroundColor: colors.bg.secondary },
              headerTintColor: colors.text.primary,
              headerBackTitle: 'Home',
            }}
          />
          <Stack.Screen
            name="workspace-board"
            options={{
              title: 'Manage Workspaces',
              headerStyle: { backgroundColor: colors.bg.secondary },
              headerTintColor: colors.text.primary,
              headerBackTitle: 'Home',
            }}
          />
          <Stack.Screen
            name="netlify-deploy"
            options={{
              title: 'Deploy to Netlify',
              headerStyle: { backgroundColor: colors.bg.secondary },
              headerTintColor: colors.text.primary,
              headerBackTitle: 'Home',
            }}
          />
          <Stack.Screen
            name="docs"
            options={{
              title: 'Documentation',
              headerStyle: { backgroundColor: colors.bg.secondary },
              headerTintColor: colors.text.primary,
              headerBackTitle: 'Home',
            }}
          />
          <Stack.Screen
            name="new-project"
            options={{
              title: 'New Project',
              headerStyle: { backgroundColor: colors.bg.secondary },
              headerTintColor: colors.text.primary,
              headerBackTitle: 'Home',
            }}
          />
          <Stack.Screen
            name="live-preview"
            options={{
              title: 'Live Preview',
              headerStyle: { backgroundColor: colors.bg.secondary },
              headerTintColor: colors.text.primary,
              headerBackTitle: 'Home',
            }}
          />
          <Stack.Screen
            name="farmwork-install"
            options={{
              title: '',
              headerStyle: { backgroundColor: colors.bg.secondary },
              headerTintColor: colors.text.primary,
              headerBackTitle: 'Home',
            }}
          />
          <Stack.Screen
            name="board"
            options={{
              title: 'The Board',
              headerStyle: { backgroundColor: colors.bg.secondary },
              headerTintColor: colors.text.primary,
              headerBackTitle: 'Home',
            }}
          />
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
