import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Image,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Play, Pause, Volume2, Radio } from 'lucide-react-native';
import { useRadio } from '@/contexts/RadioContext';
import colors from '@/constants/colors';

const { width, height } = Dimensions.get('window');
const isSmallScreen = height < 700;
const isMediumScreen = height >= 700 && height < 800;
const visualizerSize = isSmallScreen ? Math.min(width * 0.55, 200) : isMediumScreen ? Math.min(width * 0.6, 240) : Math.min(width * 0.65, 280);

export default function PlayerScreen() {
  const { isPlaying, isLoading, error, play, pause, currentStream, switchStream } = useRadio();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (isPlaying) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
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

      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 10000,
          useNativeDriver: true,
        })
      ).start();
    } else {
      pulseAnim.setValue(1);
      rotateAnim.setValue(0);
    }
  }, [isPlaying, pulseAnim, rotateAnim]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handlePlayPause = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientMiddle, colors.gradientEnd]}
      locations={[0, 0.5, 1]}
      style={styles.container}
    >
      <ScrollView 
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 20, 40), paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <Image
          source={{ uri: 'https://www.freedomskn.com/resources/uploads/2014/08/logo_ff.png' }}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.visualizer}>
          <Animated.View
            style={[
              styles.outerCircle,
              {
                transform: [{ scale: pulseAnim }, { rotate }],
              },
            ]}
          >
            <View style={styles.middleCircle}>
              <View style={styles.innerCircle}>
                <Radio size={isSmallScreen ? 45 : isMediumScreen ? 52 : 60} color={colors.text} strokeWidth={1.5} />
              </View>
            </View>
          </Animated.View>

          {isPlaying && (
            <>
              <Animated.View
                style={[
                  styles.waveRing,
                  {
                    transform: [{ scale: pulseAnim }],
                    opacity: pulseAnim.interpolate({
                      inputRange: [1, 1.15],
                      outputRange: [0.3, 0],
                    }),
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.waveRing,
                  styles.waveRing2,
                  {
                    transform: [
                      {
                        scale: pulseAnim.interpolate({
                          inputRange: [1, 1.15],
                          outputRange: [1.2, 1.35],
                        }),
                      },
                    ],
                    opacity: pulseAnim.interpolate({
                      inputRange: [1, 1.15],
                      outputRange: [0.2, 0],
                    }),
                  },
                ]}
              />
            </>
          )}
        </View>

        <View style={styles.nowPlaying}>
          <Text style={styles.nowPlayingLabel}>NOW PLAYING</Text>
          <Text style={styles.songTitle}>Live Radio Stream</Text>
          <Text style={styles.artist}>World Class Radio At Its Very Best!</Text>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity
            style={[
              styles.playButton,
              isLoading && styles.playButtonLoading,
            ]}
            onPress={handlePlayPause}
            disabled={isLoading}
          >
            <LinearGradient
              colors={['rgba(0, 0, 0, 0.7)', 'rgba(0, 0, 0, 0.5)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.playButtonGradient}
            >
              {isPlaying ? (
                <Pause size={isSmallScreen ? 40 : isMediumScreen ? 45 : 50} color={colors.text} fill={colors.text} />
              ) : (
                <View style={{ marginLeft: isSmallScreen ? 5 : 6 }}>
                  <Play size={isSmallScreen ? 40 : isMediumScreen ? 45 : 50} color={colors.text} fill={colors.text} />
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
          <Volume2 size={16} color={colors.textSecondary} />
        </View>

        <View style={styles.streamSelector}>
          <View style={styles.streamButtons}>
            <TouchableOpacity
              style={[
                styles.streamButton,
                currentStream === 'version1' && styles.streamButtonActive,
              ]}
              onPress={() => switchStream('version1')}
              disabled={isLoading}
            >
              <Text
                style={[
                  styles.streamButtonText,
                  currentStream === 'version1' && styles.streamButtonTextActive,
                ]}
              >
                Stream 1
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.streamButton,
                currentStream === 'version2' && styles.streamButtonActive,
              ]}
              onPress={() => switchStream('version2')}
              disabled={isLoading}
            >
              <Text
                style={[
                  styles.streamButtonText,
                  currentStream === 'version2' && styles.streamButtonTextActive,
                ]}
              >
                Stream 2
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  visualizer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: visualizerSize,
    width: visualizerSize,
    marginTop: isSmallScreen ? 10 : 20,
    marginBottom: isSmallScreen ? 10 : 20,
  },
  outerCircle: {
    width: visualizerSize * 0.95,
    height: visualizerSize * 0.95,
    borderRadius: visualizerSize * 0.475,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  middleCircle: {
    width: visualizerSize * 0.73,
    height: visualizerSize * 0.73,
    borderRadius: visualizerSize * 0.365,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  innerCircle: {
    width: visualizerSize * 0.51,
    height: visualizerSize * 0.51,
    borderRadius: visualizerSize * 0.255,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: isSmallScreen ? 2 : 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  waveRing: {
    position: 'absolute',
    width: visualizerSize * 0.95,
    height: visualizerSize * 0.95,
    borderRadius: visualizerSize * 0.475,
    borderWidth: isSmallScreen ? 2 : 3,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  waveRing2: {
    width: visualizerSize * 1.1,
    height: visualizerSize * 1.1,
    borderRadius: visualizerSize * 0.55,
  },
  nowPlaying: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginVertical: isSmallScreen ? 12 : isMediumScreen ? 16 : 20,
  },
  nowPlayingLabel: {
    fontSize: isSmallScreen ? 10 : 12,
    color: colors.textSecondary,
    letterSpacing: 2,
    marginBottom: isSmallScreen ? 6 : 8,
  },
  songTitle: {
    fontSize: isSmallScreen ? 20 : isMediumScreen ? 22 : 24,
    fontWeight: '700' as const,
    color: colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  artist: {
    fontSize: isSmallScreen ? 14 : 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  controls: {
    alignItems: 'center',
    marginVertical: isSmallScreen ? 12 : isMediumScreen ? 16 : 20,
  },
  playButton: {
    width: isSmallScreen ? 80 : isMediumScreen ? 90 : 100,
    height: isSmallScreen ? 80 : isMediumScreen ? 90 : 100,
    borderRadius: isSmallScreen ? 40 : isMediumScreen ? 45 : 50,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    borderWidth: isSmallScreen ? 3 : 4,
    borderColor: colors.text,
  },
  playButtonLoading: {
    opacity: 0.6,
  },
  playButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: isSmallScreen ? 16 : 20,
    paddingVertical: isSmallScreen ? 8 : 10,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginVertical: isSmallScreen ? 8 : 12,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.red,
  },
  liveText: {
    fontSize: isSmallScreen ? 12 : 14,
    fontWeight: '700' as const,
    color: colors.text,
    letterSpacing: 1,
  },
  errorContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.error + '20',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.error,
    marginTop: 16,
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
  },
  logo: {
    width: isSmallScreen ? width * 0.5 : isMediumScreen ? width * 0.55 : width * 0.6,
    height: isSmallScreen ? 50 : isMediumScreen ? 60 : 70,
    marginBottom: isSmallScreen ? 10 : 20,
  },
  streamSelector: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: isSmallScreen ? 8 : 12,
    marginBottom: isSmallScreen ? 8 : 0,
  },
  streamSelectorLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 12,
  },
  streamButtons: {
    flexDirection: 'row',
    gap: isSmallScreen ? 10 : 12,
  },
  streamButton: {
    paddingHorizontal: isSmallScreen ? 20 : 24,
    paddingVertical: isSmallScreen ? 10 : 12,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  streamButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderColor: colors.text,
  },
  streamButtonText: {
    fontSize: isSmallScreen ? 12 : 14,
    fontWeight: '600' as const,
    color: colors.textSecondary,
  },
  streamButtonTextActive: {
    color: colors.text,
  },
});
