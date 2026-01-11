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
  const tabBarHeight = 60 + insets.bottom;

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const topPad = insets.top + 8;
  const bottomPad = tabBarHeight + 8;
  const availableHeight = Math.max(0, height - topPad - bottomPad);

  const compactMode = availableHeight < 520;
  const ultraCompactMode = availableHeight < 450;

  const contentHorizontalPadding = ultraCompactMode ? 12 : compactMode ? 14 : 20;

  const controlsSectionHeight = ultraCompactMode ? 150 : compactMode ? 170 : 200;
  const mainContentHeight = availableHeight - controlsSectionHeight;

  const visualizerSize = clamp(
    Math.min(width * 0.28, mainContentHeight * 0.26),
    ultraCompactMode ? 65 : compactMode ? 75 : 90,
    ultraCompactMode ? 90 : compactMode ? 110 : 130
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
    mainContentHeight * 0.32,
    ultraCompactMode ? 70 : compactMode ? 90 : 110,
    ultraCompactMode ? 110 : compactMode ? 140 : 170
  );
  const logoWidth = width * 0.88;

  const logoToCircleSpacing = ultraCompactMode ? -2 : compactMode ? -4 : -6;

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
          },
        ]}
      >
        <View style={[styles.mainContent, { height: mainContentHeight }]}>
          <View style={styles.logoContainer}>
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
                  <Radio size={ultraCompactMode ? 28 : compactMode ? 34 : 42} color={colors.text} strokeWidth={1.5} />
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
            marginTop: ultraCompactMode ? 4 : compactMode ? 6 : 10,
          }]}>
            <Text style={[styles.nowPlayingLabel, {
              fontSize: ultraCompactMode ? 8 : compactMode ? 9 : 10,
              marginBottom: 2,
            }]}>NOW PLAYING</Text>
            <Text style={[styles.songTitle, {
              fontSize: ultraCompactMode ? 15 : compactMode ? 17 : 19,
            }]}>Live Radio Stream</Text>
            <Text style={[styles.artist, {
              fontSize: ultraCompactMode ? 10 : compactMode ? 11 : 13,
            }]}>World Class Radio At Its Very Best!</Text>
          </View>
        </View>

        <View style={[styles.bottomSection, { height: controlsSectionHeight }]}>
          <TouchableOpacity
            style={[
              styles.playButton,
              {
                width: ultraCompactMode ? 52 : compactMode ? 60 : 72,
                height: ultraCompactMode ? 52 : compactMode ? 60 : 72,
                borderRadius: ultraCompactMode ? 26 : compactMode ? 30 : 36,
                borderWidth: ultraCompactMode ? 2 : 3,
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
                <Pause size={ultraCompactMode ? 24 : compactMode ? 28 : 34} color={colors.text} fill={colors.text} />
              ) : (
                <View style={{ marginLeft: ultraCompactMode ? 2 : 3 }}>
                  <Play size={ultraCompactMode ? 24 : compactMode ? 28 : 34} color={colors.text} fill={colors.text} />
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={[styles.liveIndicator, {
            paddingHorizontal: ultraCompactMode ? 10 : compactMode ? 12 : 14,
            paddingVertical: ultraCompactMode ? 4 : compactMode ? 5 : 6,
            marginTop: ultraCompactMode ? 8 : compactMode ? 10 : 12,
          }]}>
            <View style={styles.liveDot} />
            <Text style={[styles.liveText, {
              fontSize: ultraCompactMode ? 9 : compactMode ? 10 : 11,
            }]}>LIVE</Text>
            <Volume2 size={ultraCompactMode ? 11 : 12} color={colors.textSecondary} />
          </View>

          <View style={[styles.streamSelector, {
            marginTop: ultraCompactMode ? 8 : compactMode ? 10 : 12,
          }]}>
            <View style={styles.streamButtonsRow}>
              <TouchableOpacity
                style={[
                  styles.streamButton,
                  {
                    paddingHorizontal: ultraCompactMode ? 12 : compactMode ? 16 : 22,
                    paddingVertical: ultraCompactMode ? 6 : compactMode ? 8 : 10,
                  },
                  currentStream === 'version1' && styles.streamButtonActive,
                ]}
                onPress={() => switchStream('version1')}
                disabled={isLoading}
              >
                <Text
                  style={[
                    styles.streamButtonText,
                    { fontSize: ultraCompactMode ? 11 : compactMode ? 12 : 13 },
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
                    paddingHorizontal: ultraCompactMode ? 12 : compactMode ? 16 : 22,
                    paddingVertical: ultraCompactMode ? 6 : compactMode ? 8 : 10,
                  },
                  currentStream === 'version2' && styles.streamButtonActive,
                ]}
                onPress={() => switchStream('version2')}
                disabled={isLoading}
              >
                <Text
                  style={[
                    styles.streamButtonText,
                    { fontSize: ultraCompactMode ? 11 : compactMode ? 12 : 13 },
                    currentStream === 'version2' && styles.streamButtonTextActive,
                  ]}
                >
                  Stream 2
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {error && (
            <View style={[styles.errorContainer, { marginTop: 8 }]}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </View>
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
    justifyContent: 'space-between',
  },
  mainContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSection: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  streamButtonsRow: {
    flexDirection: 'row',
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
    paddingHorizontal: 16,
  },
  nowPlayingLabel: {
    color: colors.textSecondary,
    letterSpacing: 2,
  },
  songTitle: {
    fontWeight: '700' as const,
    color: colors.text,
    marginBottom: 2,
    textAlign: 'center',
  },
  artist: {
    color: colors.textSecondary,
    textAlign: 'center',
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
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.red,
  },
  liveText: {
    fontWeight: '700' as const,
    color: colors.text,
    letterSpacing: 1,
  },
  errorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.error + '20',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.error,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    textAlign: 'center',
  },
  streamSelector: {
    alignItems: 'center',
  },
  streamButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 16,
    borderWidth: 1,
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
