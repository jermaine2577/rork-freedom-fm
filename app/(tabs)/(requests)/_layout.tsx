import { Stack } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '@/constants/colors';

export default function RequestsLayout() {
  const insets = useSafeAreaInsets();
  const headerTopPadding = Platform.OS === 'web' ? Math.max(insets.top, 20) : 0;

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#000000',
          height: Platform.OS === 'web' ? 56 + headerTopPadding : undefined,
        },
        headerTitleStyle: {
          paddingTop: Platform.OS === 'web' ? headerTopPadding : 0,
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
