import React from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import colors from '@/constants/colors';

function NewsHeader({ title, showBack }: { title: string; showBack: boolean }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
      {showBack ? (
        <TouchableOpacity
          testID="news-header-back"
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ChevronLeft size={28} color={colors.text} />
        </TouchableOpacity>
      ) : (
        <View style={styles.headerSide} />
      )}

      <Text testID="news-header-title" style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>

      <View style={styles.headerSide} />
    </View>
  );
}

export default function NewsLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: '#121212',
          },
        }}
      >
        <Stack.Screen
          name="news"
          options={{
            header: () => <NewsHeader title="News" showBack={false} />,
            headerShown: true,
          }}
        />
        <Stack.Screen
          name="[id]"
          options={{
            headerShown: false,
          }}
        />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#121212',
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  backButton: {
    width: 40,
    height: 36,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerSide: {
    width: 40,
  },
  headerTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: '700' as const,
    textAlign: 'center',
  },
});
