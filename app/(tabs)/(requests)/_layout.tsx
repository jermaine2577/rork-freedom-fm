import { Stack } from 'expo-router';
import React from 'react';
import colors from '@/constants/colors';

export default function RequestsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
        },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerBackTitle: 'Back',
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
