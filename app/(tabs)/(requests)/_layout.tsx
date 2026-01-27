import { Stack } from 'expo-router';
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import colors from '@/constants/colors';

function CustomHeader({ title }: { title: string }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.headerContainer, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.back()}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <ChevronLeft size={28} color={colors.text} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerRight} />
    </View>
  );
}

export default function RequestsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        statusBarStyle: 'light',
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
          header: () => <CustomHeader title="Song Request" />,
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="birthday-request"
        options={{
          header: () => <CustomHeader title="Birthday Request" />,
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="birthday-list"
        options={{
          header: () => <CustomHeader title="Birthday List" />,
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="anniversary"
        options={{
          header: () => <CustomHeader title="Anniversary" />,
          headerShown: true,
        }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  backButton: {
    width: 40,
    height: 36,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: '700' as const,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
});
