import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Play, Pause, Volume2, Radio } from 'lucide-react-native';
import { useRadio } from '@/contexts/RadioContext';
import colors from '@/constants/colors';

export default function PlayerScreen() {
  const { isPlaying, isLoading, error, play, pause, currentStream, switchStream } = useRadio();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  
  const [dimensions, setDimensions] = useState(() => {
    const { width, height } = Dimensions.get('window');
    return { width, height };
  });

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions({ width: window.width, height: window.height });
    });
    return () => subscription?.remove();
  }, []);

  const { width, height } = dimensions;
  const isSmallScreen = height < 700;
  const isMediumScreen = height >= 700 && height < 800;
  const visualizerSize = isSmallScreen ? Math.min(width * 0.45, 180) : isMediumScreen ? Math.min(width * 0.5, 200) : Math.min(width * 0.55, 220);

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
      <View 
        style={[
          styles.content, 
          { 
            paddingTop: insets.top + (isSmallScreen ? 8 : 12), 
            paddingBottom: insets.bottom + (isSmallScreen ? 80 : 90),
          }
        ]}
      >
        <Image
          source={{ uri: 'https://www.freedomskn.com/resources/uploads/2014/08/logo_ff.png' }}
          style={{ 
            width: isSmallScreen ? width * 0.65 : isMediumScreen ? width * 0.7 : width * 0.75,
            height: isSmallScreen ? 55 : isMediumScreen ? 65 : 75,
            marginBottom: isSmallScreen ? 6 : 10,
            alignSelf: 'center',
          }}
          resizeMode="contain"
        />
        <View style={{
          alignItems: 'center',
          justifyContent: 'center',
          height: visualizerSize,
          width: visualizerSize,
        }}>
          <Animated.View
            style={[
              styles.outerCircle,
              {
                width: visualizerSize * 0.95,
                height: visualizerSize * 0.95,
                borderRadius: visualizerSize * 0.475,
                transform: [{ scale: pulseAnim }, { rotate }],
              },
            ]}
          >
            <View style={[styles.middleCircle, {
              width: visualizerSize * 0.73,
              height: visualizerSize * 0.73,
              borderRadius: visualizerSize * 0.365,
            }]}>
              <View style={[styles.innerCircle, {
                width: visualizerSize * 0.51,
                height: visualizerSize * 0.51,
                borderRadius: visualizerSize * 0.255,
                borderWidth: isSmallScreen ? 2 : 3,
              }]}>
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
                    width: visualizerSize * 0.95,
                    height: visualizerSize * 0.95,
                    borderRadius: visualizerSize * 0.475,
                    borderWidth: isSmallScreen ? 2 : 3,
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
                  {
                    width: visualizerSize * 1.1,
                    height: visualizerSize * 1.1,
                    borderRadius: visualizerSize * 0.55,
                    borderWidth: isSmallScreen ? 2 : 3,
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

        <View style={[styles.nowPlaying, {
          marginTop: isSmallScreen ? 8 : 12,
          marginBottom: isSmallScreen ? 8 : 12,
        }]}>
          <Text style={[styles.nowPlayingLabel, {
            fontSize: isSmallScreen ? 10 : 12,
            marginBottom: isSmallScreen ? 4 : 6,
          }]}>NOW PLAYING</Text>
          <Text style={[styles.songTitle, {
            fontSize: isSmallScreen ? 20 : isMediumScreen ? 22 : 24,
          }]}>Live Radio Stream</Text>
          <Text style={[styles.artist, {
            fontSize: isSmallScreen ? 14 : 16,
          }]}>World Class Radio At Its Very Best!</Text>
        </View>

        <View style={[styles.controls, {
          marginVertical: isSmallScreen ? 8 : 12,
        }]}>
          <TouchableOpacity
            style={[
              styles.playButton,
              {
                width: isSmallScreen ? 80 : isMediumScreen ? 90 : 100,
                height: isSmallScreen ? 80 : isMediumScreen ? 90 : 100,
                borderRadius: isSmallScreen ? 40 : isMediumScreen ? 45 : 50,
                borderWidth: isSmallScreen ? 3 : 4,
              },
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

        <View style={[styles.liveIndicator, {
          paddingHorizontal: isSmallScreen ? 16 : 20,
          paddingVertical: isSmallScreen ? 8 : 10,
          marginBottom: isSmallScreen ? 6 : 8,
        }]}>
          <View style={styles.liveDot} />
          <Text style={[styles.liveText, {
            fontSize: isSmallScreen ? 12 : 14,
          }]}>LIVE</Text>
          <Volume2 size={16} color={colors.textSecondary} />
        </View>

        <View style={styles.streamSelector}>
          <View style={{
            flexDirection: 'row',
            gap: isSmallScreen ? 10 : 12,
          }}>
            <TouchableOpacity
              style={[
                styles.streamButton,
                {
                  paddingHorizontal: isSmallScreen ? 20 : 24,
                  paddingVertical: isSmallScreen ? 10 : 12,
                },
                currentStream === 'version1' && styles.streamButtonActive,
              ]}
              onPress={() => switchStream('version1')}
              disabled={isLoading}
            >
              <Text
                style={[
                  styles.streamButtonText,
                  {
                    fontSize: isSmallScreen ? 12 : 14,
                  },
                  currentStream === 'version1' && styles.streamButtonTextActive,
                ]}
              >
                Stream 1
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.streamButton,
                {
                  paddingHorizontal: isSmallScreen ? 20 : 24,
                  paddingVertical: isSmallScreen ? 10 : 12,
                },
                currentStream === 'version2' && styles.streamButtonActive,
              ]}
              onPress={() => switchStream('version2')}
              disabled={isLoading}
            >
              <Text
                style={[
                  styles.streamButtonText,
                  {
                    fontSize: isSmallScreen ? 12 : 14,
                  },
                  currentStream === 'version2' && styles.streamButtonTextActive,
                ]}
              >
                Stream 2
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {error && (
          <View style={[styles.errorContainer, { marginTop: isSmallScreen ? 6 : 8 }]}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 20,
  },
  outerCircle: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  middleCircle: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  innerCircle: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  waveRing: {
    position: 'absolute',
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  nowPlaying: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  nowPlayingLabel: {
    color: colors.textSecondary,
    letterSpacing: 2,
  },
  songTitle: {
    fontWeight: '700' as const,
    color: colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  artist: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
  controls: {
    alignItems: 'center',
  },
  playButton: {
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
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
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.red,
  },
  liveText: {
    fontWeight: '700' as const,
    color: colors.text,
    letterSpacing: 1,
  },
  errorContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.error + '20',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.error,
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
  },
  streamSelector: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  streamButton: {
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
    fontWeight: '600' as const,
    color: colors.textSecondary,
  },
  streamButtonTextActive: {
    color: colors.text,
  },
});
