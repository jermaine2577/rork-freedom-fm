import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

export default function SongRequestScreen() {
  const url = 'https://freedomfm1065.com/song-request/';

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
          title="Song Request"
          onLoad={(e: any) => {
            try {
              const iframe = e.target;
              const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
              if (iframeDoc) {
                const style = iframeDoc.createElement('style');
                style.textContent = 'header, footer, .site-header, .site-footer { display: none !important; }';
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
            function hideElements() {
              const style = document.createElement('style');
              style.textContent = \`
                header, footer, .site-header, .site-footer,
                nav, .navigation, .navbar, .menu,
                #header, #footer, #masthead, #site-header, #site-footer,
                .header, .footer, [role="banner"], [role="contentinfo"] {
                  display: none !important;
                  visibility: hidden !important;
                  height: 0 !important;
                  overflow: hidden !important;
                }
                body { padding-top: 0 !important; }
              \`;
              document.head.appendChild(style);
            }
            hideElements();
            setTimeout(hideElements, 100);
            setTimeout(hideElements, 500);
            setTimeout(hideElements, 1000);
          })();
          true;
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
