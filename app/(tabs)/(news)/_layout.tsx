import { Stack } from 'expo-router';
import colors from '@/constants/colors';

export default function NewsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
        },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTitleAlign: 'center',
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
        }}
      />
    </Stack>
  );
}
