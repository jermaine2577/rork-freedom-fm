import React, { useState } from 'react';
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
import { CalendarDays } from 'lucide-react-native';

interface BirthdayListData {
  first_name: string;
  last_name: string;
}

export default function BirthdayListScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const submitMutation = useMutation({
    mutationFn: async (data: BirthdayListData) => {
      const response = await fetch(
        'https://freedomfm1065.com/wp-json/chatroom/v1/forms/submit',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            form_type: 'birthday_list',
            form_data: data,
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
      Alert.alert('Success', data.message || 'Added to birthday list successfully!');
      setFirstName('');
      setLastName('');
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message || 'Failed to submit');
    },
  });

  const handleSubmit = () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Required Fields', 'Please fill in first name and last name');
      return;
    }

    submitMutation.mutate({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
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
          <CalendarDays size={48} color="#4CAF50" strokeWidth={2} />
          <Text style={styles.title}>Birthday List</Text>
          <Text style={styles.subtitle}>Add your name to our birthday list</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              First Name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Enter first name"
              placeholderTextColor="#999"
              editable={!submitMutation.isPending}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Last Name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Enter last name"
              placeholderTextColor="#999"
              editable={!submitMutation.isPending}
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
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#4CAF50',
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
});
