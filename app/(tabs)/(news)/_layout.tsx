import { Stack } from 'expo-router';
import colors from '@/constants/colors';

export default function NewsLayout() {
  return (
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
        },
        contentStyle: {
          backgroundColor: '#000',
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
          headerBackVisible: true,
          headerBackTitle: 'Back',
        }}
      />
    </Stack>
  );
}
