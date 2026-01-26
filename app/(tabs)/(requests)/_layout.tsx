import { Stack } from 'expo-router';
import React from 'react';
import colors from '@/constants/colors';

export default function RequestsLayout() {
  return (
    <Stack
      screenOptions={{
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
