import React from 'react';
import { StyleSheet, View } from 'react-native';

// Dark background for Android and web
export default function TabBarBackground() {
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000000' }]} />;
}

export function useBottomTabOverflow() {
  return 0;
}
