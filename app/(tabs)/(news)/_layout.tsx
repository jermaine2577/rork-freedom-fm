import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '@/constants/colors';

export default function NewsLayout() {
  const insets = useSafeAreaInsets();
  
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#000',
        },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTitleAlign: 'center',
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
