import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Image, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as SplashScreen from "expo-splash-screen";
import colors from "@/constants/colors";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RadioProvider } from "@/contexts/RadioContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { TermsProvider } from "@/contexts/TermsContext";

import ErrorBoundary from "@/components/ErrorBoundary";

const RADIO_LOGO_URI =
  "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/b3vamp0ku602q6ojiaqvd";

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
      retryDelay: 1000,
    },
  },
});

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

function AppContent() {
  return (
    <RadioProvider>
      <ChatProvider>
        <RootLayoutNav />
      </ChatProvider>
    </RadioProvider>
  );
}

function AnimatedSplash({ onFinish }: { onFinish: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.delay(500),
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onFinish();
    });
  }, [opacity, containerOpacity, onFinish]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.splashContainer, { opacity: containerOpacity }]}
    >
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientMiddle, colors.gradientEnd]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={{ opacity }}>
        <Image
          source={{ uri: RADIO_LOGO_URI }}
          style={styles.splashLogo}
          resizeMode="contain"
        />
      </Animated.View>
    </Animated.View>
  );
}

export default function RootLayout() {
  const [splashDone, setSplashDone] = useState<boolean>(false);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <StatusBar style="light" translucent={false} backgroundColor="#000000" />
            <TermsProvider>
              <AppContent />
            </TermsProvider>
            {!splashDone && (
              <AnimatedSplash onFinish={() => setSplashDone(true)} />
            )}
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  splashLogo: {
    width: 220,
    height: 220,
  },
});
