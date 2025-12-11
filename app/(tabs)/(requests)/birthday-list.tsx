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
import { Calendar } from 'lucide-react-native';
import colors from '@/constants/colors';

export default function BirthdayListScreen() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [alias, setAlias] = useState('');
  const [address, setAddress] = useState('');
  const [date, setDate] = useState('');

  const clearForm = () => {
    setFirstName('');
    setLastName('');
    setAlias('');
    setAddress('');
    setDate('');
  };

  const handleSubmit = async () => {
    if (!firstName.trim()) {
      Alert.alert('Missing Information', 'Please enter first name.');
      return;
    }
    if (!lastName.trim()) {
      Alert.alert('Missing Information', 'Please enter last name.');
      return;
    }
    if (!date.trim()) {
      Alert.alert('Missing Information', 'Please enter date.');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('form_type', 'birthday_list');
      formData.append('first_name', firstName);
      formData.append('last_name', lastName);
      formData.append('alias', alias);
      formData.append('address', address);
      formData.append('date', date);

      const response = await fetch('https://freedomfm1065.com/wp-content/themes/dj-rainflow-child/form-handler.php', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      console.log('Birthday list result:', result);
      
      if (result.success) {
        Alert.alert(
          'Submitted Successfully!',
          result.message || 'Thank you! Your birthday has been added to our list.',
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
      console.log('Birthday list error:', error);
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
            <Calendar size={32} color={colors.yellow} />
          </View>
          <Text style={styles.title}>Birthday List</Text>
          <Text style={styles.subtitle}>Add your birthday to our celebration list</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.labelText}>First Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter first name"
              placeholderTextColor={colors.textSecondary}
              value={firstName}
              onChangeText={setFirstName}
              maxLength={100}
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.labelText}>Last Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter last name"
              placeholderTextColor={colors.textSecondary}
              value={lastName}
              onChangeText={setLastName}
              maxLength={100}
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.labelText}>Alias (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter alias or nickname"
              placeholderTextColor={colors.textSecondary}
              value={alias}
              onChangeText={setAlias}
              maxLength={100}
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.labelText}>Address (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter address"
              placeholderTextColor={colors.textSecondary}
              value={address}
              onChangeText={setAddress}
              maxLength={200}
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.labelText}>Date *</Text>
            <TextInput
              style={styles.input}
              placeholder="MM/DD/YYYY"
              placeholderTextColor={colors.textSecondary}
              value={date}
              onChangeText={setDate}
              maxLength={10}
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
            <Text style={styles.submitButtonText}>Submit</Text>
          )}
        </TouchableOpacity>

        <View style={styles.info}>
          <Text style={styles.infoText}>* Required fields</Text>
          <Text style={styles.infoText}>
            Your birthday will be added to our celebration list at Freedom FM 106.5.
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
