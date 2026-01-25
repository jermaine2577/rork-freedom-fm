import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '@/constants/colors';

export default function NewsLayout() {
  const insets = useSafeAreaInsets();
  const webTopPadding = Platform.OS === 'web' ? Math.max(insets.top, 28) : 0;

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#000',
          },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          headerTitleAlign: 'center',
          headerTitleStyle: {
            fontWeight: '700',
            fontSize: 17,
            ...(Platform.OS === 'web' && { marginTop: webTopPadding }),
          },
          contentStyle: {
            backgroundColor: '#000',
            ...(Platform.OS === 'web' && { marginTop: webTopPadding }),
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
