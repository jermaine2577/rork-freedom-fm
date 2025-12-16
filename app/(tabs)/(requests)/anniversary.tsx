import React from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import WebView from 'react-native-webview';

export default function AnniversaryScreen() {
  const url = 'https://freedomfm1065.com/mobile-forms/?type=anniversary_list';

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <iframe
          src={url}
          style={{ flex: 1, border: 'none', width: '100%', height: '100%' }}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: url }}
        style={styles.webview}
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
