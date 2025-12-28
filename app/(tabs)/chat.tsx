import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Platform, ActivityIndicator, Text, TouchableOpacity, Linking, Modal, AppState } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import { useTerms } from '@/contexts/TermsContext';
import TermsAgreementScreen from '@/components/TermsAgreementScreen';
import { Mail, AlertCircle, X } from 'lucide-react-native';
import colors from '@/constants/colors';

export default function ChatScreen() {
  const { hasAcceptedTerms, isLoading: termsLoading } = useTerms();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const [key, setKey] = useState(0);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const webViewRef = useRef<any>(null);
  const mountedRef = useRef(true);

  const handleRetry = useCallback(() => {
    console.log('[Chat] Retry button pressed');
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    setError(false);
    setLoading(true);
    setRetryCount(prev => prev + 1);
    setKey(prev => prev + 1);
  }, []);

  const handleRefresh = useCallback(() => {
    console.log('[Chat] Refresh button pressed');
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    setError(false);
    setLoading(true);
    if (webViewRef.current) {
      webViewRef.current.reload();
    } else {
      setKey(prev => prev + 1);
    }
  }, []);

  const handleContactPress = () => {
    setShowReportModal(true);
  };

  const handleSendEmail = () => {
    setShowReportModal(false);
    Linking.openURL('mailto:freedomradio1065@yahoo.com?subject=Chat Report - Freedom FM');
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && error) {
        console.log('[Chat] App became active, resetting error state');
        handleRetry();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [error, handleRetry]);

  useEffect(() => {
    if (loading && !error) {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      loadingTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current && loading) {
          console.log('[Chat] Loading timeout - forcing error state');
          setLoading(false);
          setError(true);
        }
      }, 20000);
    }

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };
  }, [loading, error, retryCount]);

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

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={[styles.contactButton, { top: insets.top + 50 }]} onPress={handleContactPress}>
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
      <Modal
        visible={showReportModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientMiddle, colors.gradientEnd]}
              locations={[0, 0.5, 1]}
              style={styles.modalGradient}
            >
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowReportModal(false)}
              >
                <X size={24} color={colors.text} />
              </TouchableOpacity>
              
              <View style={styles.modalIconContainer}>
                <View style={styles.modalIconCircle}>
                  <AlertCircle size={48} color={colors.text} strokeWidth={2} />
                </View>
              </View>

              <Text style={styles.modalTitle}>Report Content</Text>
              
              <Text style={styles.modalMessage}>
                To report inappropriate content or behavior, please contact us at:
              </Text>
              
              <View style={styles.emailContainer}>
                <Mail size={18} color={colors.text} />
                <Text style={styles.emailText}>freedomradio1065@yahoo.com</Text>
              </View>

              <Text style={styles.modalFooter}>
                We respond to all reports within 24 hours
              </Text>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowReportModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.sendButton}
                  onPress={handleSendEmail}
                >
                  <LinearGradient
                    colors={['rgba(0, 0, 0, 0.7)', 'rgba(0, 0, 0, 0.5)']}
                    style={styles.sendButtonGradient}
                  >
                    <Mail size={20} color={colors.text} />
                    <Text style={styles.sendButtonText}>Send Email</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      <View style={[styles.topButtons, { top: insets.top + 50 }]}>
        <TouchableOpacity style={styles.contactButton} onPress={handleContactPress}>
          <Mail size={20} color="#FFFFFF" />
          <Text style={styles.contactButtonText}>Report</Text>
        </TouchableOpacity>
        {!loading && !error && (
          <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
            <Text style={styles.refreshButtonText}>↻</Text>
          </TouchableOpacity>
        )}
      </View>
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
          ref={webViewRef}
          key={`${retryCount}-${key}`}
          source={{ uri: 'https://freedomfm1065.com/mobile-chatroom/' }}
          style={styles.webview}
          injectedJavaScript={injectedJavaScript}
          onMessage={() => {}}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={false}
          cacheEnabled={false}
          incognito={false}
          mixedContentMode="always"
          onLoadStart={() => {
            if (!mountedRef.current) return;
            console.log('[Chat] WebView load started');
            setLoading(true);
            setError(false);
          }}
          onLoadEnd={() => {
            if (!mountedRef.current) return;
            console.log('[Chat] WebView load ended successfully');
            if (loadingTimeoutRef.current) {
              clearTimeout(loadingTimeoutRef.current);
              loadingTimeoutRef.current = null;
            }
            setLoading(false);
            setError(false);
          }}
          onError={(syntheticEvent) => {
            if (!mountedRef.current) return;
            const { nativeEvent } = syntheticEvent;
            console.error('[Chat] WebView error:', nativeEvent);
            if (loadingTimeoutRef.current) {
              clearTimeout(loadingTimeoutRef.current);
              loadingTimeoutRef.current = null;
            }
            setLoading(false);
            setError(true);
          }}
          onHttpError={(syntheticEvent) => {
            if (!mountedRef.current) return;
            const { nativeEvent } = syntheticEvent;
            console.error('[Chat] WebView HTTP error:', nativeEvent.statusCode);
            if (loadingTimeoutRef.current) {
              clearTimeout(loadingTimeoutRef.current);
              loadingTimeoutRef.current = null;
            }
            setLoading(false);
            setError(true);
          }}
          onRenderProcessGone={(syntheticEvent) => {
            if (!mountedRef.current) return;
            const { nativeEvent } = syntheticEvent;
            console.error('[Chat] WebView process gone:', nativeEvent);
            if (loadingTimeoutRef.current) {
              clearTimeout(loadingTimeoutRef.current);
              loadingTimeoutRef.current = null;
            }
            setLoading(false);
            setError(true);
            setKey(prev => prev + 1);
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
  topButtons: {
    position: 'absolute',
    right: 12,
    flexDirection: 'row',
    gap: 8,
    zIndex: 10,
  },
  contactButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  refreshButton: {
    backgroundColor: '#333',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  contactButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 10,
  },
  modalGradient: {
    padding: 28,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  modalIconContainer: {
    marginBottom: 20,
  },
  modalIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
    opacity: 0.9,
  },
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  emailText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  modalFooter: {
    fontSize: 14,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 28,
    opacity: 0.8,
    fontStyle: 'italic',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  sendButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.text,
  },
  sendButtonGradient: {
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
});
