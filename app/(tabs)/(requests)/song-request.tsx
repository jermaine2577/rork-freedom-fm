import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { Music } from 'lucide-react-native';
import { WebView } from 'react-native-webview';

interface SongRequestData {
  your_name: string;
  to_name: string;
  message: string;
  requested_song?: string;
}

const RECAPTCHA_SITE_KEY = '6LeL9SQsAAAAALTfO1y4_SJ9bLPVM9Z5L65E2RXf';

export default function SongRequestScreen() {
  const [yourName, setYourName] = useState('');
  const [toName, setToName] = useState('');
  const [message, setMessage] = useState('');
  const [requestedSong, setRequestedSong] = useState('');
  const [recaptchaToken, setRecaptchaToken] = useState<string>('');
  const webViewRef = useRef<WebView>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://www.google.com/recaptcha/api.js';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);

      (window as any).onRecaptchaSuccess = (token: string) => {
        setRecaptchaToken(token);
      };

      return () => {
        document.head.removeChild(script);
        delete (window as any).onRecaptchaSuccess;
      };
    }
  }, []);

  const submitMutation = useMutation({
    mutationFn: async (data: SongRequestData) => {
      const response = await fetch(
        'https://freedomfm1065.com/wp-json/chatroom/v1/forms/submit',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            form_type: 'song_request',
            form_data: data,
            'g-recaptcha-response': recaptchaToken,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to submit request');
      }

      return result;
    },
    onSuccess: (data) => {
      Alert.alert('Success', data.message || 'Song request submitted successfully!');
      setYourName('');
      setToName('');
      setMessage('');
      setRequestedSong('');
      setRecaptchaToken('');
      webViewRef.current?.reload();
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message || 'Failed to submit request');
    },
  });

  const handleSubmit = () => {
    if (!yourName.trim() || !toName.trim() || !message.trim()) {
      Alert.alert('Required Fields', 'Please fill in your name, recipient name, and message');
      return;
    }

    const data: SongRequestData = {
      your_name: yourName.trim(),
      to_name: toName.trim(),
      message: message.trim(),
    };

    if (requestedSong.trim()) {
      data.requested_song = requestedSong.trim();
    }

    submitMutation.mutate(data);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Music size={48} color="#E63946" strokeWidth={2} />
          <Text style={styles.title}>Song Request</Text>
          <Text style={styles.subtitle}>Request a song for someone special</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Your Name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={yourName}
              onChangeText={setYourName}
              placeholder="Enter your name"
              placeholderTextColor="#999"
              editable={!submitMutation.isPending}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              To <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={toName}
              onChangeText={setToName}
              placeholder="Recipient's name"
              placeholderTextColor="#999"
              editable={!submitMutation.isPending}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Requested Song</Text>
            <TextInput
              style={styles.input}
              value={requestedSong}
              onChangeText={setRequestedSong}
              placeholder="Song name (optional)"
              placeholderTextColor="#999"
              editable={!submitMutation.isPending}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Message <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={message}
              onChangeText={setMessage}
              placeholder="Your message"
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!submitMutation.isPending}
            />
          </View>

          {Platform.OS === 'web' && (
            <View style={styles.recaptchaContainer}>
              <div
                ref={recaptchaContainerRef as any}
                className="g-recaptcha"
                data-sitekey={RECAPTCHA_SITE_KEY}
                data-callback="onRecaptchaSuccess"
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  padding: 10,
                }}
              />
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitButton, submitMutation.isPending && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitMutation.isPending}
          >
            {submitMutation.isPending ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Request</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#1A1A1A',
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  form: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1A1A1A',
    marginBottom: 8,
  },
  required: {
    color: '#E63946',
  },
  input: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1A1A1A',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 16,
  },
  submitButton: {
    backgroundColor: '#E63946',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#E63946',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700' as const,
  },
  recaptchaContainer: {
    marginBottom: 20,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F8F9FA',
  },
  recaptcha: {
    height: 80,
    backgroundColor: 'transparent',
  },
});
