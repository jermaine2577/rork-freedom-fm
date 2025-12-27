import React, { useState } from 'react';
import { StyleSheet, View, Platform, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import WebView from 'react-native-webview';
import colors from '@/constants/colors';
import { RefreshCw } from 'lucide-react-native';

export default function SongRequestScreen() {
  const url = 'https://freedomfm1065.com/mobile-forms/?type=song_request';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [key, setKey] = useState(0);

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
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.yellow} />
          <Text style={styles.loadingText}>Loading form...</Text>
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
    gap: 12,
  },
  loadingText: {
    color: colors.text,
    fontSize: 16,
    marginTop: 8,
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
