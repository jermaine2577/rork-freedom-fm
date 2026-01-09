import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { View, StyleSheet, Platform, ActivityIndicator, Text, TouchableOpacity, Linking, Modal, AppState } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import { useTerms } from '@/contexts/TermsContext';
import TermsAgreementScreen from '@/components/TermsAgreementScreen';
import { Mail, AlertCircle, X } from 'lucide-react-native';
import colors from '@/constants/colors';

const ClimbingLoader = memo(() => {
  return (
    <View style={styles.climbingContainer}>
      <Text style={styles.climbingText}>Climbing up on di Freedom Wall...</Text>
      <ActivityIndicator size="large" color="#FF6B35" style={{ marginTop: 16 }} />
    </View>
  );
});
ClimbingLoader.displayName = 'ClimbingLoader';

const TopButtons = memo(({ top, onContactPress, onRefreshPress, showRefresh }: {
  top: number;
  onContactPress: () => void;
  onRefreshPress: () => void;
  showRefresh: boolean;
}) => (
  <View 
    style={[styles.topButtons, { top }]} 
    pointerEvents="box-none"
    collapsable={false}
  >
    <TouchableOpacity 
      style={styles.contactButton} 
      onPress={onContactPress}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Mail size={20} color="#FFFFFF" />
      <Text style={styles.contactButtonText}>Report</Text>
    </TouchableOpacity>
    {showRefresh && (
      <TouchableOpacity 
        style={styles.refreshButton} 
        onPress={onRefreshPress}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.refreshButtonText}>↻</Text>
      </TouchableOpacity>
    )}
  </View>
));
TopButtons.displayName = 'TopButtons';

export default function ChatScreen() {
  const { hasAcceptedTerms } = useTerms();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [key, setKey] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const webViewRef = useRef<any>(null);
  const loadStartedRef = useRef(false);

  const handleRetry = useCallback(() => {
    console.log('[Chat] Retry button pressed');
    setError(false);
    setLoading(true);
    loadStartedRef.current = false;
    setKey(prev => prev + 1);
  }, []);

  const handleRefresh = useCallback(() => {
    console.log('[Chat] Refresh button pressed');
    setError(false);
    setLoading(true);
    loadStartedRef.current = false;
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
    button, a, input, textarea, select, [role="button"], .button {
      pointer-events: auto !important;
      -webkit-user-select: auto !important;
      user-select: auto !important;
      -webkit-touch-callout: default !important;
      cursor: pointer !important;
      opacity: 1 !important;
      visibility: visible !important;
      display: inline-block !important;
    }
    * {
      -webkit-tap-highlight-color: rgba(0,0,0,0.1);
      -webkit-user-select: auto;
      user-select: auto;
    }
  `;

  const injectedJavaScriptBeforeContentLoaded = `
    (function() {
      const style = document.createElement('style');
      style.textContent = \`${injectedCSS}\`;
      if (document.head) {
        document.head.appendChild(style);
      } else {
        document.addEventListener('DOMContentLoaded', function() {
          document.head.appendChild(style);
        });
      }
    })();
    true;
  `;

  const injectedJavaScript = `
    (function() {
      const style = document.createElement('style');
      style.textContent = \`${injectedCSS}\`;
      document.head.appendChild(style);
      
      function ensureButtonsVisible() {
        const buttons = document.querySelectorAll('button, a, input, [role="button"], .button, .delete-btn, .block-btn, .reply-btn');
        buttons.forEach(function(btn) {
          btn.style.pointerEvents = 'auto';
          btn.style.opacity = '1';
          btn.style.visibility = 'visible';
          btn.style.display = btn.tagName === 'A' || btn.tagName === 'BUTTON' ? 'inline-block' : btn.style.display || 'block';
          btn.style.webkitUserSelect = 'auto';
          btn.style.userSelect = 'auto';
        });
      }
      
      ensureButtonsVisible();
      
      setTimeout(ensureButtonsVisible, 500);
      setTimeout(ensureButtonsVisible, 1000);
      setTimeout(ensureButtonsVisible, 2000);
      
      const observer = new MutationObserver(ensureButtonsVisible);
      observer.observe(document.body, { childList: true, subtree: true });
      
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'CONTENT_READY' }));
    })();
    true;
  `;

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <TopButtons 
          top={insets.top + 60}
          onContactPress={handleContactPress}
          onRefreshPress={handleRefresh}
          showRefresh={!loading && !error}
        />
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Failed to load chat</Text>
            <Text style={styles.errorSubtext}>Please check your connection and try again</Text>
            <Text onPress={handleRetry} style={styles.retryButton}>Retry</Text>
          </View>
        )}
        {!error && (
          <iframe
            key={key}
            src="https://freedomfm1065.com/mobile-chatroom/"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              flex: 1,
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
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Freedom Wall</Text>
      </View>

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

      {loading && !error && <ClimbingLoader />}
      
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load chat</Text>
          <Text style={styles.errorSubtext}>Please check your connection and try again</Text>
          <Text onPress={handleRetry} style={styles.retryButton}>Retry</Text>
        </View>
      )}
      {!error && (
        <View style={styles.webview}>
          <WebView
            ref={webViewRef}
            key={key}
            source={{ uri: 'https://freedomfm1065.com/mobile-chatroom/' }}
            style={styles.webviewInner}
            injectedJavaScriptBeforeContentLoaded={injectedJavaScriptBeforeContentLoaded}
            injectedJavaScript={injectedJavaScript}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            cacheEnabled={true}
            mixedContentMode="always"
            originWhitelist={['*']}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            allowsFullscreenVideo={false}
            bounces={true}
            scrollEnabled={true}
            showsVerticalScrollIndicator={true}
            showsHorizontalScrollIndicator={false}
            javaScriptCanOpenWindowsAutomatically={true}
            allowFileAccess={true}
            allowUniversalAccessFromFileURLs={true}
            nestedScrollEnabled={true}
            overScrollMode="always"
            contentMode="mobile"
          onLoadStart={() => {
            if (loadStartedRef.current) return;
            loadStartedRef.current = true;
            console.log('[Chat] WebView load started');
          }}
          onLoadEnd={() => {
            console.log('[Chat] WebView load ended');
            setLoading(false);
            setError(false);
          }}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('[Chat] WebView error:', nativeEvent);
            loadStartedRef.current = false;
            setLoading(false);
            setError(true);
          }}
          onHttpError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('[Chat] WebView HTTP error:', nativeEvent.statusCode);
          }}
          onRenderProcessGone={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('[Chat] WebView process gone:', nativeEvent);
            loadStartedRef.current = false;
            setLoading(false);
            setError(true);
            setKey(prev => prev + 1);
          }}
          />
        </View>
      )}
      
      <TopButtons 
        top={insets.top + 60}
        onContactPress={handleContactPress}
        onRefreshPress={handleRefresh}
        showRefresh={!loading && !error}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  webview: {
    flex: 1,
    overflow: 'hidden',
  },
  webviewInner: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    zIndex: 9999,
    elevation: 999,
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
    elevation: 1000,
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
    elevation: 1000,
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
  climbingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  climbingText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 107, 53, 0.3)',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FF6B35',
    letterSpacing: 0.5,
  },
});
