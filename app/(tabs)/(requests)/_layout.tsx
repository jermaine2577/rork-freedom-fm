import { Stack } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '@/constants/colors';

export default function RequestsLayout() {
  const insets = useSafeAreaInsets();
  const headerStatusBarHeight = Math.max(insets.top, Platform.OS === 'web' ? 14 : 0);

  return (
    <Stack
      screenOptions={{
        headerTopInsetEnabled: false,
        headerStatusBarHeight,
        statusBarStyle: 'light',
        statusBarTranslucent: false,
        headerStyle: {
          backgroundColor: '#000000',
        },
        headerTitleStyle: {
          color: colors.text,
          fontWeight: '600' as const,
          fontSize: 17,
        },
        headerTransparent: false,
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerBackTitle: 'Back',
        contentStyle: {
          backgroundColor: '#000000',
        },
      }}
    >
      <Stack.Screen
        name="requests"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="song-request"
        options={{
          title: 'Song Request',
        }}
      />
      <Stack.Screen
        name="birthday-request"
        options={{
          title: 'Birthday Request',
        }}
      />
      <Stack.Screen
        name="birthday-list"
        options={{
          title: 'Birthday List',
        }}
      />
      <Stack.Screen
        name="anniversary"
        options={{
          title: 'Anniversary',
        }}
      />
    </Stack>
  );
}
