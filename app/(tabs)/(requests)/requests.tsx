import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Music, Cake, Heart, Calendar, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import colors from '@/constants/colors';

interface RequestOption {
  id: string;
  title: string;
  subtitle: string;
  icon: typeof Music;
  route: string;
}

const REQUEST_OPTIONS: RequestOption[] = [
  {
    id: 'song',
    title: 'Song Request',
    subtitle: 'Request your favorite song to be played',
    icon: Music,
    route: '/song-request',
  },
  {
    id: 'birthday-request',
    title: 'Birthday Request',
    subtitle: 'Submit a birthday celebration request',
    icon: Cake,
    route: '/birthday-request',
  },
  {
    id: 'birthday-list',
    title: 'Birthday List',
    subtitle: 'Add your birthday to our celebration list',
    icon: Calendar,
    route: '/birthday-list',
  },
  {
    id: 'anniversary',
    title: 'Anniversary',
    subtitle: 'Submit your anniversary information',
    icon: Heart,
    route: '/anniversary',
  },
];

export default function RequestIndexScreen() {
  const router = useRouter();

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientMiddle, colors.gradientEnd]}
      locations={[0, 0.5, 1]}
      style={styles.container}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Make a Request</Text>
          <Text style={styles.subtitle}>
            Choose the type of request you&apos;d like to submit
          </Text>
        </View>

        <View style={styles.optionsContainer}>
          {REQUEST_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <TouchableOpacity
                key={option.id}
                style={styles.optionCard}
                onPress={() => router.push(option.route as any)}
                activeOpacity={0.7}
              >
                <View style={styles.iconContainer}>
                  <Icon size={28} color={colors.yellow} />
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>{option.title}</Text>
                  <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
                </View>
                <ChevronRight size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            All requests will be sent to Freedom FM 106.5
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: colors.text,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  optionsContainer: {
    gap: 16,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    gap: 16,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  optionContent: {
    flex: 1,
    gap: 4,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.text,
  },
  optionSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  footer: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  footerText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
