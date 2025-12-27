import React, { useState } from 'react';
import { View, StyleSheet, Platform, ActivityIndicator, Text, TouchableOpacity, Linking, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTerms } from '@/contexts/TermsContext';
import TermsAgreementScreen from '@/components/TermsAgreementScreen';
import { Mail } from 'lucide-react-native';

export default function ChatScreen() {
  const { hasAcceptedTerms, isLoading: termsLoading } = useTerms();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const handleContactPress = () => {
    Alert.alert(
      'Report Content',
      'To report inappropriate content or behavior, please contact us at:\n\nfreedomfm1065@gmail.com\n\nWe respond to all reports within 24 hours.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Email',
          onPress: () => {
            Linking.openURL('mailto:freedomfm1065@gmail.com?subject=Chat Report - Freedom FM');
          },
        },
      ]
    );
  };

  if (termsLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!hasAcceptedTerms) {
    return <TermsAgreementScreen />;
  }

  const injectedCSS = `
    header,
    footer,
    .site-header,
    .site-footer,
    nav,
    .navigation,
    .menu,
    .header,
    .footer,
    .top-bar,
    .bottom-bar,
    #header,
    #footer {
      display: none !important;
    }
    body {
      padding: 0 !important;
      margin: 0 !important;
    }
  `;

  const injectedJavaScript = `
    (function() {
      const style = document.createElement('style');
      style.textContent = \`${injectedCSS}\`;
      document.head.appendChild(style);
    })();
    true;
  `;

  const handleRetry = () => {
    setError(false);
    setLoading(true);
    setRetryCount(prev => prev + 1);
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.contactButton} onPress={handleContactPress}>
          <Mail size={20} color="#FFFFFF" />
          <Text style={styles.contactButtonText}>Report</Text>
        </TouchableOpacity>
        {loading && !error && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF6B35" />
            <Text style={styles.loadingText}>Loading the freedom wall...</Text>
          </View>
        )}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Failed to load chat</Text>
            <Text style={styles.errorSubtext}>Please check your connection and try again</Text>
            <Text onPress={handleRetry} style={styles.retryButton}>Retry</Text>
          </View>
        )}
        {!error && (
          <iframe
            key={retryCount}
            src="https://freedomfm1065.com/mobile-chatroom/"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
            }}
            title="Freedom Wall Chat"
            onLoad={() => {
              setLoading(false);
              setError(false);
            }}
            onError={() => {
              setLoading(false);
              setError(true);
            }}
          />
        )}
        <style>{`
          iframe {
            width: 100%;
            height: 100%;
            border: none;
          }
        `}</style>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.contactButton} onPress={handleContactPress}>
        <Mail size={20} color="#FFFFFF" />
        <Text style={styles.contactButtonText}>Report</Text>
      </TouchableOpacity>
      {loading && !error && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Loading the freedom wall...</Text>
        </View>
      )}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load chat</Text>
          <Text style={styles.errorSubtext}>Please check your connection and try again</Text>
          <Text onPress={handleRetry} style={styles.retryButton}>Retry</Text>
        </View>
      )}
      {!error && (
        <WebView
          key={retryCount}
          source={{ uri: 'https://freedomfm1065.com/mobile-chatroom/' }}
          style={styles.webview}
          injectedJavaScript={injectedJavaScript}
          onMessage={(event) => {
            try {
              const data = event.nativeEvent.data;
              if (data && typeof data === 'string' && data.trim().length > 0) {
                const trimmedData = data.trim();
                const firstChar = trimmedData[0];
                if (firstChar === '{' || firstChar === '[') {
                  try {
                    JSON.parse(trimmedData);
                  } catch {
                    console.log('WebView sent non-JSON message, ignoring');
                  }
                }
              }
            } catch (error) {
              console.log('WebView message handler error:', error);
            }
          }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          onLoadStart={() => {
            setLoading(true);
            setError(false);
          }}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
          onHttpError={() => {
            setLoading(false);
            setError(true);
          }}
        />
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
    zIndex: 1,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 12,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorSubtext: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FF6B35',
    overflow: 'hidden',
  },
  contactButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#FF6B35',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  contactButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
