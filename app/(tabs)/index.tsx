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

const RADIO_LOGO_URI = 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/b3vamp0ku602q6ojiaqvd';

export default function PlayerScreen() {
  const { isPlaying, isLoading, error, play, pause, currentStream, switchStream } = useRadio();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>(() => {
    const { width, height } = Dimensions.get('window');
    return { width, height };
  });

  const [logoFailed, setLogoFailed] = useState<boolean>(false);

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions({ width: window.width, height: window.height });
    });
    return () => subscription?.remove();
  }, []);

  const { width, height } = dimensions;
  const isSmallScreen = height < 700;
  const isMediumScreen = height >= 700 && height < 800;
  const tabBarHeight = 60 + insets.bottom;

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const topPad = insets.top + 10;
  const baseBottomPad = tabBarHeight + 16;
  const availableHeightBase = Math.max(0, height - topPad - baseBottomPad);

  const compactMode = availableHeightBase < 560;
  const ultraCompactMode = availableHeightBase < 500;

  const bottomPadExtra = ultraCompactMode ? 10 : compactMode ? 12 : 16;
  const bottomPad = tabBarHeight + bottomPadExtra;
  const availableHeight = Math.max(0, height - topPad - bottomPad);

  const contentHorizontalPadding = ultraCompactMode ? 14 : compactMode ? 16 : 20;
  const contentGap = ultraCompactMode ? 4 : compactMode ? 6 : 8;

  const visualizerSize = clamp(
    Math.min(width * 0.38, availableHeight * (ultraCompactMode ? 0.19 : compactMode ? 0.215 : 0.235)),
    ultraCompactMode ? 86 : isSmallScreen || compactMode ? 96 : 116,
    ultraCompactMode ? 122 : isSmallScreen || compactMode ? 140 : 164
  );

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

  const logoHeight = clamp(
    Math.max(availableHeight * (ultraCompactMode ? 0.18 : compactMode ? 0.195 : 0.21), visualizerSize * (ultraCompactMode ? 1.25 : 1.35)),
    ultraCompactMode ? 112 : isSmallScreen || compactMode ? 124 : 148,
    ultraCompactMode ? 162 : isSmallScreen || compactMode ? 188 : 220
  );
  const logoWidth = ultraCompactMode
    ? width * 0.92
    : isSmallScreen || compactMode
      ? width * 0.94
      : isMediumScreen
        ? width * 0.96
        : width * 0.98;

  const logoToCircleSpacing = clamp(
    (ultraCompactMode ? -8 : isSmallScreen || compactMode ? -10 : isMediumScreen ? -14 : -16),
    -16,
    -4
  );

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientMiddle, colors.gradientEnd]}
      locations={[0, 0.5, 1]}
      style={styles.container}
    >
      <View
        testID="radio-screen"
        style={[
          styles.content,
          {
            paddingTop: topPad,
            paddingBottom: bottomPad,
            paddingHorizontal: contentHorizontalPadding,
            gap: contentGap,
          },
        ]}
      >
        <View style={{ width: '100%', alignItems: 'center', justifyContent: 'center' }}>
          <Image
            testID="radio-logo"
            source={logoFailed ? require('../../assets/images/icon.png') : { uri: RADIO_LOGO_URI }}
            onError={(e) => {
              console.log('[Radio] Logo failed to render', { nativeEvent: e?.nativeEvent });
              setLogoFailed(true);
            }}
            style={{
              width: logoWidth,
              height: logoHeight,
            }}
            resizeMode="contain"
          />
        </View>
        <View
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            height: visualizerSize,
            width: visualizerSize,
            marginTop: logoToCircleSpacing,
          }}
        >
          
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
          marginTop: ultraCompactMode ? 2 : isSmallScreen || compactMode ? 4 : 10,
          marginBottom: ultraCompactMode ? 0 : isSmallScreen || compactMode ? 2 : 6,
        }]}>
          <Text style={[styles.nowPlayingLabel, {
            fontSize: isSmallScreen || compactMode ? 9 : 11,
            marginBottom: isSmallScreen || compactMode ? 2 : 4,
          }]}>NOW PLAYING</Text>
          <Text style={[styles.songTitle, {
            fontSize: isSmallScreen || compactMode ? 18 : isMediumScreen ? 20 : 22,
          }]}>Live Radio Stream</Text>
          <Text style={[styles.artist, {
            fontSize: isSmallScreen || compactMode ? 12 : 14,
          }]}>World Class Radio At Its Very Best!</Text>
        </View>

        <View style={[styles.controls, {
          marginVertical: ultraCompactMode ? 0 : isSmallScreen || compactMode ? 2 : 8,
        }]}>
          <TouchableOpacity
            style={[
              styles.playButton,
              {
                width: ultraCompactMode ? 64 : isSmallScreen || compactMode ? 68 : isMediumScreen ? 80 : 90,
                height: ultraCompactMode ? 64 : isSmallScreen || compactMode ? 68 : isMediumScreen ? 80 : 90,
                borderRadius: ultraCompactMode ? 32 : isSmallScreen || compactMode ? 34 : isMediumScreen ? 40 : 45,
                borderWidth: ultraCompactMode ? 3 : isSmallScreen || compactMode ? 3 : 4,
              },
              isLoading && styles.playButtonLoading,
            ]}
            onPress={handlePlayPause}
            disabled={isLoading}
          >
            <LinearGradient
              colors={['rgba(0, 0, 0, 0.72)', 'rgba(0, 0, 0, 0.52)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.playButtonGradient}
            >
              {isPlaying ? (
                <Pause size={isSmallScreen || compactMode ? 32 : isMediumScreen ? 38 : 44} color={colors.text} fill={colors.text} />
              ) : (
                <View style={{ marginLeft: isSmallScreen || compactMode ? 4 : 5 }}>
                  <Play size={isSmallScreen || compactMode ? 32 : isMediumScreen ? 38 : 44} color={colors.text} fill={colors.text} />
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={[styles.liveIndicator, {
          paddingHorizontal: isSmallScreen || compactMode ? 14 : 18,
          paddingVertical: isSmallScreen || compactMode ? 6 : 8,
        }]}>
          <View style={styles.liveDot} />
          <Text style={[styles.liveText, {
            fontSize: isSmallScreen || compactMode ? 11 : 13,
          }]}>LIVE</Text>
          <Volume2 size={14} color={colors.textSecondary} />
        </View>

        <View
          style={[
            styles.streamSelector,
            {
              marginTop: ultraCompactMode ? 4 : isSmallScreen || compactMode ? 6 : 14,
              marginBottom: ultraCompactMode ? 2 : isSmallScreen || compactMode ? 4 : 10,
              paddingBottom: ultraCompactMode ? 2 : 4,
            },
          ]}
        >
          <View style={{
            flexDirection: 'row',
            gap: isSmallScreen || compactMode ? 8 : 12,
          }}>
            <TouchableOpacity
              style={[
                styles.streamButton,
                {
                  paddingHorizontal: isSmallScreen || compactMode ? 18 : 32,
                  paddingVertical: isSmallScreen || compactMode ? 10 : 14,
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
                    fontSize: isSmallScreen || compactMode ? 13 : 15,
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
                  paddingHorizontal: isSmallScreen || compactMode ? 18 : 32,
                  paddingVertical: isSmallScreen || compactMode ? 10 : 14,
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
                    fontSize: isSmallScreen || compactMode ? 13 : 15,
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
          <View style={[styles.errorContainer, { marginTop: isSmallScreen || compactMode ? 6 : 8 }]}>
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
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    gap: 8,
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
    width: '100%',
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
