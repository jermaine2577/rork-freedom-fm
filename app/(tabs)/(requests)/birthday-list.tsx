import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Platform, ActivityIndicator, Text, TouchableOpacity, Animated } from 'react-native';
import WebView from 'react-native-webview';
import colors from '@/constants/colors';
import { RefreshCw, Calendar } from 'lucide-react-native';

export default function BirthdayListScreen() {
  const url = 'https://freedomfm1065.com/mobile-forms/?type=birthday_list';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [key, setKey] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [loading, fadeAnim, pulseAnim]);

  const handleRetry = () => {
    setError(false);
    setLoading(true);
    setKey(prev => prev + 1);
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <iframe
          src={url}
          style={{ flex: 1, border: 'none', width: '100%', height: '100%' }}
          onLoad={() => setLoading(false)}
        />
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.yellow} />
            <Text style={styles.loadingText}>Loading form...</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.webviewContainer, { opacity: fadeAnim }]}>
        <WebView
          key={key}
          source={{ uri: url }}
          style={styles.webview}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
          startInLoadingState={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          cacheEnabled={true}
        />
      </Animated.View>
      {loading && (
        <View style={styles.loadingContainer}>
          <Animated.View style={[styles.iconPulse, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.iconCircle}>
              <Calendar size={40} color={colors.yellow} strokeWidth={2.5} />
            </View>
          </Animated.View>
          <View style={styles.skeletonContainer}>
            <View style={styles.skeletonBar} />
            <View style={styles.skeletonBarShort} />
            <View style={styles.skeletonBar} />
            <View style={styles.skeletonBarMedium} />
          </View>
          <Text style={styles.loadingText}>Preparing your request form</Text>
          <View style={styles.dotsContainer}>
            <View style={[styles.dot, styles.dot1]} />
            <View style={[styles.dot, styles.dot2]} />
            <View style={[styles.dot, styles.dot3]} />
          </View>
        </View>
      )}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Unable to load form</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <RefreshCw size={20} color={colors.yellow} />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webviewContainer: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  iconPulse: {
    marginBottom: 32,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderWidth: 3,
    borderColor: colors.yellow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skeletonContainer: {
    width: '100%',
    maxWidth: 320,
    gap: 16,
    marginBottom: 32,
  },
  skeletonBar: {
    height: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    width: '100%',
  },
  skeletonBarShort: {
    height: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    width: '60%',
  },
  skeletonBarMedium: {
    height: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    width: '80%',
  },
  loadingText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600' as const,
    marginBottom: 16,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.yellow,
  },
  dot1: {
    opacity: 0.4,
  },
  dot2: {
    opacity: 0.7,
  },
  dot3: {
    opacity: 1,
  },
  errorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 20,
  },
  errorText: {
    color: colors.text,
    fontSize: 18,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.yellow,
  },
  retryText: {
    color: colors.yellow,
    fontSize: 16,
    fontWeight: '600' as const,
  },
});
