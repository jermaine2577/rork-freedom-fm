import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Music, Cake, Heart, Calendar, ChevronRight, Mail, HelpCircle } from 'lucide-react-native';
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
  const [showContactModal, setShowContactModal] = React.useState(false);

  const handleContactPress = () => {
    setShowContactModal(true);
  };

  const handleSendEmail = () => {
    setShowContactModal(false);
    Linking.openURL('mailto:freedomradio1065@yahoo.com?subject=Contact Freedom FM');
  };

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

        <TouchableOpacity
          style={styles.contactCard}
          onPress={handleContactPress}
          activeOpacity={0.7}
        >
          <View style={styles.contactIconContainer}>
            <HelpCircle size={24} color={colors.yellow} />
          </View>
          <View style={styles.contactContent}>
            <Text style={styles.contactTitle}>Need Help?</Text>
            <Text style={styles.contactSubtitle}>Contact us for support or to report issues</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            All requests will be sent to Freedom FM 106.5
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={showContactModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowContactModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientMiddle, colors.gradientEnd]}
              locations={[0, 0.5, 1]}
              style={styles.modalGradient}
            >
              <View style={styles.modalIconContainer}>
                <View style={styles.modalIconCircle}>
                  <Mail size={48} color={colors.text} strokeWidth={2} />
                </View>
              </View>

              <Text style={styles.modalTitle}>Contact Us</Text>
              
              <Text style={styles.modalMessage}>
                Have questions, feedback, or need to report something?
              </Text>
              
              <View style={styles.emailContainer}>
                <Mail size={18} color={colors.text} />
                <Text style={styles.emailText}>freedomradio1065@yahoo.com</Text>
              </View>

              <Text style={styles.modalFooter}>
                We respond to all inquiries within 24 hours
              </Text>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowContactModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Close</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.sendButton}
                  onPress={handleSendEmail}
                >
                  <LinearGradient
                    colors={['rgba(0, 0, 0, 0.7)', 'rgba(0, 0, 0, 0.5)']}
                    style={styles.sendButtonGradient}
                  >
                    <Mail size={20} color={colors.text} />
                    <Text style={styles.sendButtonText}>Send Email</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>
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
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 107, 53, 0.3)',
    gap: 16,
    marginTop: 24,
  },
  contactIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  contactContent: {
    flex: 1,
    gap: 4,
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.text,
  },
  contactSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 10,
  },
  modalGradient: {
    padding: 28,
    alignItems: 'center',
  },
  modalIconContainer: {
    marginBottom: 20,
  },
  modalIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
    opacity: 0.9,
  },
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  emailText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text,
  },
  modalFooter: {
    fontSize: 14,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 28,
    opacity: 0.8,
    fontStyle: 'italic' as const,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text,
  },
  sendButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.text,
  },
  sendButtonGradient: {
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.text,
  },
});
