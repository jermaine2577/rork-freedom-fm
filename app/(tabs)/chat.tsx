import React, { useState } from 'react';
import { View, StyleSheet, Platform, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';

export default function ChatScreen() {
  const [loading, setLoading] = useState(true);

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
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF6B35" />
            <Text style={styles.loadingText}>Loading the freedom wall...</Text>
          </View>
        )}
        <iframe
          src="https://freedomfm1065.com/mobile-chatroom/"
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
          }}
          title="Freedom Wall Chat"
          onLoad={() => setLoading(false)}
        />
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
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Loading the freedom wall...</Text>
        </View>
      )}
      <WebView
        source={{ uri: 'https://freedomfm1065.com/mobile-chatroom/' }}
        style={styles.webview}
        injectedJavaScript={injectedJavaScript}
        onMessage={() => {}}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
      />
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
});
