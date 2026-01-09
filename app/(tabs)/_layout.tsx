import { Tabs } from "expo-router";
import { Radio, Newspaper, MessageCircle, Music } from "lucide-react-native";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import colors from "@/constants/colors";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.yellow,
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.5)',
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          borderTopColor: 'rgba(255, 255, 255, 0.1)',
          borderTopWidth: 2,
          paddingBottom: insets.bottom,
          height: 60 + insets.bottom,
        },
        headerStyle: {
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
        },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Radio",
          tabBarIcon: ({ color, size }) => <Radio color={color} size={size} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="(news)"
        options={{
          title: "News",
          tabBarIcon: ({ color, size }) => <Newspaper color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Wall",
          tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="(requests)"
        options={{
          title: "Request",
          tabBarIcon: ({ color, size }) => <Music color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
