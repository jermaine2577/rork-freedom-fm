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
import { Heart } from 'lucide-react-native';
import colors from '@/constants/colors';

export default function AnniversaryScreen() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [names, setNames] = useState('');
  const [anniversaryType, setAnniversaryType] = useState('');
  const [address, setAddress] = useState('');
  const [date, setDate] = useState('');

  const clearForm = () => {
    setNames('');
    setAnniversaryType('');
    setAddress('');
    setDate('');
  };

  const handleSubmit = async () => {
    if (!names.trim()) {
      Alert.alert('Missing Information', 'Please enter name(s).');
      return;
    }
    if (!anniversaryType.trim()) {
      Alert.alert('Missing Information', 'Please select anniversary type.');
      return;
    }
    if (!address.trim()) {
      Alert.alert('Missing Information', 'Please enter address.');
      return;
    }
    if (!date.trim()) {
      Alert.alert('Missing Information', 'Please enter date.');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('form_type', 'anniversary_list');
      formData.append('name', names);
      formData.append('anniversary_type', anniversaryType);
      formData.append('address', address);
      formData.append('date', date);

      const response = await fetch('https://freedomfm1065.com/wp-content/themes/dj-rainflow-child/form-handler.php', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      console.log('Anniversary result:', result);
      
      if (result.success) {
        Alert.alert(
          'Submitted Successfully!',
          result.message || 'Thank you! Your anniversary has been submitted.',
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
      console.log('Anniversary error:', error);
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
            <Heart size={32} color={colors.yellow} />
          </View>
          <Text style={styles.title}>Anniversary</Text>
          <Text style={styles.subtitle}>Submit your anniversary information</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.labelText}>Name(s) *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter name(s)"
              placeholderTextColor={colors.textSecondary}
              value={names}
              onChangeText={setNames}
              maxLength={200}
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.labelText}>Anniversary Type *</Text>
            <View style={styles.typeSelector}>
              {['Wedding Anniversary', 'Dating Anniversary', 'Engagement Anniversary', 'Other'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeButton,
                    anniversaryType === type && styles.typeButtonSelected,
                  ]}
                  onPress={() => setAnniversaryType(type)}
                  disabled={isSubmitting}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      anniversaryType === type && styles.typeButtonTextSelected,
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.labelText}>Address *</Text>
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
            Your anniversary will be sent to Freedom FM 106.5.
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
  typeSelector: {
    gap: 10,
  },
  typeButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
  },
  typeButtonSelected: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderColor: colors.yellow,
  },
  typeButtonText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: colors.textSecondary,
  },
  typeButtonTextSelected: {
    color: colors.yellow,
    fontWeight: '600' as const,
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
