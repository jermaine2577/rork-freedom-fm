import { Tabs } from "expo-router";
import { Radio, Newspaper, MessageCircle, Music, Bell } from "lucide-react-native";
import React from "react";
import { View, StyleSheet } from "react-native";
import colors from "@/constants/colors";
import { useAnnouncementsBadge } from "@/contexts/AnnouncementsBadgeContext";

export default function TabLayout() {
  const { showBadge } = useAnnouncementsBadge();

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
          title: "Chat",
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
      <Tabs.Screen
        name="announcements"
        options={{
          title: "Alerts",
          tabBarIcon: ({ color, size }) => (
            <View>
              <Bell color={color} size={size} />
              {showBadge && <View style={styles.badge} />}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF0000',
  },
});
