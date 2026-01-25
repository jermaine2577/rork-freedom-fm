import React, { useMemo } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '@/constants/colors';

export default function NewsLayout() {
  const insets = useSafeAreaInsets();

  const headerTopPadding = useMemo(() => {
    if (Platform.OS !== 'web') return 0;
    return Math.max(insets.top, 28);
  }, [insets.top]);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#121212',
            height: 56 + headerTopPadding,
          },
          headerTitleContainerStyle: {
            paddingTop: headerTopPadding,
          },
          headerLeftContainerStyle: {
            paddingTop: headerTopPadding,
          },
          headerRightContainerStyle: {
            paddingTop: headerTopPadding,
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
            title: 'News',
          }}
        />
        <Stack.Screen
          name="[id]"
          options={{
            title: 'Article',
            headerBackTitle: 'Back',
          }}
        />
      </Stack>
    </>
  );
}
