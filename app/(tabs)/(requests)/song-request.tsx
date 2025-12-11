import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Music } from 'lucide-react-native';
import colors from '@/constants/colors';

export default function SongRequestScreen() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [yourName, setYourName] = useState('');
  const [toName, setToName] = useState('');
  const [requestedSong, setRequestedSong] = useState('');
  const [message, setMessage] = useState('');
  const [dj, setDj] = useState('');

  const clearForm = () => {
    setYourName('');
    setToName('');
    setRequestedSong('');
    setMessage('');
    setDj('');
  };

  const handleSubmit = async () => {
    if (!yourName.trim()) {
      Alert.alert('Missing Information', 'Please enter your name.');
      return;
    }
    if (!toName.trim()) {
      Alert.alert('Missing Information', 'Please enter the recipient name.');
      return;
    }
    if (!requestedSong.trim()) {
      Alert.alert('Missing Information', 'Please enter the requested song.');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('form_type', 'song_request');
      formData.append('your_name', yourName);
      formData.append('to_name', toName);
      formData.append('requested_song', requestedSong);
      formData.append('message', message);
      formData.append('dj', dj);

      const response = await fetch('https://freedomfm1065.com/wp-content/themes/dj-rainflow-child/form-handler.php', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      console.log('Song request result:', result);
      
      if (result.success) {
        Alert.alert(
          'Request Submitted!',
          result.message || 'Thank you! Your song request has been received.',
          [{ text: 'OK', onPress: clearForm }]
        );
      } else {
        Alert.alert(
          'Error',
          result.message || 'There was an error submitting your request. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.log('Song request error:', error);
      Alert.alert(
        'Error',
        'Unable to submit your request. Please check your connection and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
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
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Music size={32} color={colors.yellow} />
          </View>
          <Text style={styles.title}>Song Request</Text>
          <Text style={styles.subtitle}>Request your favorite song to be played</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.labelText}>Your Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your name"
              placeholderTextColor={colors.textSecondary}
              value={yourName}
              onChangeText={setYourName}
              maxLength={100}
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.labelText}>To Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Who is this request for?"
              placeholderTextColor={colors.textSecondary}
              value={toName}
              onChangeText={setToName}
              maxLength={100}
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.labelText}>Requested Song *</Text>
            <TextInput
              style={styles.input}
              placeholder="Artist - Song title"
              placeholderTextColor={colors.textSecondary}
              value={requestedSong}
              onChangeText={setRequestedSong}
              maxLength={200}
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.labelText}>Message/Dedication (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Add a message or dedication..."
              placeholderTextColor={colors.textSecondary}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={4}
              maxLength={500}
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.labelText}>DJ (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Preferred DJ (if any)"
              placeholderTextColor={colors.textSecondary}
              value={dj}
              onChangeText={setDj}
              maxLength={100}
              editable={!isSubmitting}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.text} size="small" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Request</Text>
          )}
        </TouchableOpacity>

        <View style={styles.info}>
          <Text style={styles.infoText}>* Required fields</Text>
          <Text style={styles.infoText}>
            Your request will be sent to Freedom FM 106.5.
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
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  labelText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.textSecondary,
  },
  input: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginTop: 8,
    minHeight: 56,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text,
  },
  info: {
    marginTop: 24,
    gap: 8,
  },
  infoText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
