import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarLabelStyle: {
          fontSize: 16,
          fontWeight: '600',
          marginTop: -4,
          marginBottom: 12,
        },
        tabBarIconStyle: {
          marginTop: 12,
          marginBottom: -4,
        },
        tabBarStyle: Platform.select({
          ios: {
            // Use a transparent background on iOS to show the blur effect
            position: 'absolute',
            paddingBottom: 10,
            height: 80,
            backgroundColor: '#000000',
          },
          default: {
            paddingBottom: 10,
            marginBottom: 10,
            height: 80,
            backgroundColor: '#000000',
          },
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Songs',
          tabBarIcon: ({ color }) => <IconSymbol size={32} name="music.note" color={color} />,
        }}
      />
      <Tabs.Screen
        name="playlists"
        options={{
          title: 'Playlists',
          tabBarIcon: ({ color }) => <IconSymbol size={32} name="music.note.list" color={color} />,
        }}
      />
    </Tabs>
  );
}
