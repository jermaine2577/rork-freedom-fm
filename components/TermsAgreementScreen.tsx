import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useTerms } from '@/contexts/TermsContext';
import { AlertCircle } from 'lucide-react-native';

export default function TermsAgreementScreen() {
  const { acceptTerms } = useTerms();
  const [isAccepting, setIsAccepting] = useState(false);

  const handleAccept = async () => {
    setIsAccepting(true);
    await acceptTerms();
    setIsAccepting(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <AlertCircle size={48} color="#FF6B35" />
        <Text style={styles.title}>Terms of Use</Text>
        <Text style={styles.subtitle}>Please read and accept to continue</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Age Requirement</Text>
        <Text style={styles.text}>
          You must be 18 years or older to use the Freedom Wall chat feature.
        </Text>

        <Text style={styles.sectionTitle}>Zero Tolerance Policy</Text>
        <Text style={styles.text}>
          Freedom FM has a strict zero-tolerance policy for objectionable content and abusive behavior. This includes but is not limited to:
        </Text>
        <Text style={styles.bulletText}>• Harassment, bullying, or threats</Text>
        <Text style={styles.bulletText}>• Hate speech or discrimination</Text>
        <Text style={styles.bulletText}>• Sexual or explicit content</Text>
        <Text style={styles.bulletText}>• Spam or illegal activities</Text>
        <Text style={styles.bulletText}>• Impersonation or false information</Text>

        <Text style={styles.sectionTitle}>Content Moderation</Text>
        <Text style={styles.text}>
          All content is monitored and moderated. Freedom FM reserves the right to:
        </Text>
        <Text style={styles.bulletText}>• Filter and remove objectionable content</Text>
        <Text style={styles.bulletText}>• Ban users who violate these terms</Text>
        <Text style={styles.bulletText}>• Review and act on reports within 24 hours</Text>

        <Text style={styles.sectionTitle}>Reporting & Blocking</Text>
        <Text style={styles.text}>
          You have the ability to:
        </Text>
        <Text style={styles.bulletText}>• Report inappropriate content or users</Text>
        <Text style={styles.bulletText}>• Block abusive users</Text>
        <Text style={styles.bulletText}>• Remove your own posts from the feed</Text>

        <Text style={styles.sectionTitle}>Contact for Reports</Text>
        <Text style={styles.text}>
          Report inappropriate activity or violations:
        </Text>
        <Text style={styles.contactText}>Email: freedomradio1065@yahoo.com</Text>
        <Text style={styles.contactText}>Response Time: Within 24 hours</Text>

        <Text style={styles.sectionTitle}>Your Responsibility</Text>
        <Text style={styles.text}>
          By accepting these terms, you agree to:
        </Text>
        <Text style={styles.bulletText}>• Be respectful and follow community guidelines</Text>
        <Text style={styles.bulletText}>• Not post objectionable or harmful content</Text>
        <Text style={styles.bulletText}>• Report violations when you see them</Text>
        <Text style={styles.bulletText}>• Accept that violations may result in permanent ban</Text>

        <Text style={styles.warning}>
          Violation of these terms will result in immediate removal of content and permanent account suspension.
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.acceptButton, isAccepting && styles.acceptButtonDisabled]}
          onPress={handleAccept}
          disabled={isAccepting}
        >
          {isAccepting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.acceptButtonText}>I Accept - I am 18 or older</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF6B35',
    marginTop: 24,
    marginBottom: 12,
  },
  text: {
    fontSize: 15,
    color: '#CCCCCC',
    lineHeight: 22,
    marginBottom: 12,
  },
  bulletText: {
    fontSize: 15,
    color: '#CCCCCC',
    lineHeight: 22,
    marginBottom: 8,
    paddingLeft: 8,
  },
  contactText: {
    fontSize: 15,
    color: '#FF6B35',
    lineHeight: 22,
    marginBottom: 4,
    fontWeight: '600',
  },
  warning: {
    fontSize: 14,
    color: '#FF6B35',
    lineHeight: 20,
    marginTop: 24,
    padding: 16,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.3)',
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  acceptButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  acceptButtonDisabled: {
    opacity: 0.5,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
