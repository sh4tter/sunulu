import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';

export default function BlurTabBarBackground() {
  return (
    <BlurView
      // Use dark tint to match app theme
      tint="dark"
      intensity={100}
      style={[StyleSheet.absoluteFill, { backgroundColor: '#000000' }]}
    />
  );
}

export function useBottomTabOverflow() {
  return useBottomTabBarHeight();
}
