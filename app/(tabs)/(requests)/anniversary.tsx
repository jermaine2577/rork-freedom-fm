import React, { useState, useRef } from 'react';
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
import { Heart } from 'lucide-react-native';
import { WebView } from 'react-native-webview';

interface AnniversaryListData {
  names: string;
  anniversary_type: string;
  date: string;
}

const RECAPTCHA_SITE_KEY = '6LeL9SQsAAAAALTfO1y4_SJ9bLPVM9Z5L65E2RXf';

export default function AnniversaryScreen() {
  const [names, setNames] = useState('');
  const [anniversaryType, setAnniversaryType] = useState('');
  const [date, setDate] = useState('');
  const [recaptchaToken, setRecaptchaToken] = useState<string>('');
  const webViewRef = useRef<WebView>(null);

  const submitMutation = useMutation({
    mutationFn: async (data: AnniversaryListData) => {
      const response = await fetch(
        'https://freedomfm1065.com/wp-json/chatroom/v1/forms/submit',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            form_type: 'anniversary_list',
            form_data: data,
            'g-recaptcha-response': recaptchaToken,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to submit');
      }

      return result;
    },
    onSuccess: (data) => {
      Alert.alert('Success', data.message || 'Added to anniversary list successfully!');
      setNames('');
      setAnniversaryType('');
      setDate('');
      setRecaptchaToken('');
      webViewRef.current?.reload();
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message || 'Failed to submit');
    },
  });

  const handleSubmit = () => {
    if (!names.trim() || !anniversaryType.trim() || !date.trim()) {
      Alert.alert('Required Fields', 'Please fill in all required fields');
      return;
    }

    if (!recaptchaToken) {
      Alert.alert('Verification Required', 'Please complete the reCAPTCHA verification');
      return;
    }

    submitMutation.mutate({
      names: names.trim(),
      anniversary_type: anniversaryType.trim(),
      date: date.trim(),
    });
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
          <Heart size={48} color="#9C27B0" strokeWidth={2} />
          <Text style={styles.title}>Anniversary List</Text>
          <Text style={styles.subtitle}>Add your anniversary to our list</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Names <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={names}
              onChangeText={setNames}
              placeholder="e.g., John & Jane Smith"
              placeholderTextColor="#999"
              editable={!submitMutation.isPending}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Anniversary Type <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={anniversaryType}
              onChangeText={setAnniversaryType}
              placeholder="e.g., Wedding, Business, etc."
              placeholderTextColor="#999"
              editable={!submitMutation.isPending}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Date <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="MM/DD/YYYY"
              placeholderTextColor="#999"
              editable={!submitMutation.isPending}
            />
          </View>

          <View style={styles.recaptchaContainer}>
            <WebView
              ref={webViewRef}
              style={styles.recaptcha}
              source={{
                html: `
                  <!DOCTYPE html>
                  <html>
                    <head>
                      <meta name="viewport" content="width=device-width, initial-scale=1.0">
                      <script src="https://www.google.com/recaptcha/api.js" async defer></script>
                      <style>
                        body { margin: 0; padding: 10px; display: flex; justify-content: center; }
                      </style>
                    </head>
                    <body>
                      <div class="g-recaptcha" data-sitekey="${RECAPTCHA_SITE_KEY}" data-callback="onRecaptchaSuccess"></div>
                      <script>
                        function onRecaptchaSuccess(token) {
                          window.ReactNativeWebView.postMessage(token);
                        }
                      </script>
                    </body>
                  </html>
                `,
              }}
              onMessage={(event) => {
                setRecaptchaToken(event.nativeEvent.data);
              }}
              javaScriptEnabled
              scrollEnabled={false}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, submitMutation.isPending && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitMutation.isPending}
          >
            {submitMutation.isPending ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitButtonText}>Add to List</Text>
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
  submitButton: {
    backgroundColor: '#9C27B0',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#9C27B0',
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
