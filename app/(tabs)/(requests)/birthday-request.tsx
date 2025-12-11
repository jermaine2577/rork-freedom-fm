import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

export default function BirthdayRequestScreen() {
  const url = 'https://freedomfm1065.com/birthday-request/';

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <iframe
          src={url}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
          }}
          title="Birthday Request"
          onLoad={(e: any) => {
            try {
              const iframe = e.target;
              const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
              if (iframeDoc) {
                const style = iframeDoc.createElement('style');
                style.textContent = 'header { display: none !important; }';
                iframeDoc.head.appendChild(style);
              }
            } catch (err) {
              console.log('Cannot access iframe content due to CORS');
            }
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: url }}
        style={styles.webview}
        startInLoadingState
        scalesPageToFit
        javaScriptEnabled
        domStorageEnabled
        injectedJavaScript={`
          (function() {
            const style = document.createElement('style');
            style.textContent = 'header { display: none !important; }';
            document.head.appendChild(style);
          })();
        `}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
});
