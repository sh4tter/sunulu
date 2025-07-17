import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { MusicProvider, useMusic } from '../contexts/MusicContext';

function AppContent() {
  const { user, loading } = useAuth();
  const {
    pauseSong,
    resumeSong,
    skipNext,
    skipPrevious,
    seekTo,
  } = useMusic();

  // Handle music widget button presses (rewind / play / pause / forward)
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const actionId = response.actionIdentifier;
      const data: any = response.notification.request.content.data;

      switch (actionId) {
        case 'REWIND':
          // Seek back 10 seconds
          if (data?.position) {
            const newPosition = Math.max(0, data.position - 10);
            seekTo(newPosition);
          }
          break;
        case 'PAUSE':
          pauseSong();
          break;
        case 'PLAY':
          resumeSong();
          break;
        case 'FORWARD':
          // Seek forward 10 seconds
          if (data?.position) {
            const newPosition = data.position + 10;
            seekTo(newPosition);
          }
          break;
      }
    });

    return () => sub.remove();
  }, [pauseSong, resumeSong, skipNext, skipPrevious, seekTo]);

  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded || loading) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <>
      <Stack>
        {user ? (
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        ) : (
          <Stack.Screen name="auth" options={{ headerShown: false }} />
        )}
        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AppContent />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <MusicProvider>
        <RootLayoutNav />
        <StatusBar style="light" />
      </MusicProvider>
    </AuthProvider>
  );
}
