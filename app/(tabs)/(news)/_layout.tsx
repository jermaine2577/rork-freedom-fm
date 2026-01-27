import React, { useMemo } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '@/constants/colors';

export default function NewsLayout() {
  const insets = useSafeAreaInsets();


  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{

          headerStyle: {
            backgroundColor: '#121212',
          },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          headerTitleAlign: 'center',
          headerTitleStyle: {
            fontWeight: '700',
            fontSize: 17,
          },
          contentStyle: {
            backgroundColor: '#121212',
          },
        }}
      >
        <Stack.Screen
          name="news"
          options={{
            title: 'News Headlines',
          }}
        />
        <Stack.Screen
          name="[id]"
          options={{
            title: 'Article',
            headerBackTitle: 'Back',
            headerShown: Platform.OS !== 'web',
          }}
        />
      </Stack>
    </>
  );
}
