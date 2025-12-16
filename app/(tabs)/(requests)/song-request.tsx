import React from 'react';
import { StyleSheet, View } from 'react-native';
import WebView from 'react-native-webview';

export default function SongRequestScreen() {
  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: 'https://freedomfm1065.com/mobile-forms/?type=song_request' }}
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
