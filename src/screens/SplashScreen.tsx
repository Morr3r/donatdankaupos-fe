import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ChevronsUp, Sparkles } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandLogo } from '../components/ui';
import { palette, radius, spacing, type } from '../theme/tokens';
import { useReducedMotionPreference } from '../utils/useReducedMotion';

const SPLASH_VIDEO = require('../../assets/splash-screen.mp4');
const SWIPE_DISTANCE = 76;
const SWIPE_VELOCITY = -650;
const USE_NATIVE_DRIVER = process.env.EXPO_OS !== 'web';

interface SplashScreenProps {
  appReady: boolean;
  onComplete: () => void;
}

export function SplashScreen({ appReady, onComplete }: SplashScreenProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const motionPreference = useReducedMotionPreference();
  const reduceMotion = motionPreference === true;
  const [videoFinished, setVideoFinished] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [continueRequested, setContinueRequested] = useState(false);
  const isExiting = useRef(false);
  const dragY = useRef(new Animated.Value(0)).current;
  const promptOpacity = useRef(new Animated.Value(0)).current;
  const promptY = useRef(new Animated.Value(28)).current;
  const arrowY = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;

  const player = useVideoPlayer(SPLASH_VIDEO, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.muted = true;
    videoPlayer.timeUpdateEventInterval = 0.12;
  });

  const revealPrompt = useCallback(() => {
    setVideoFinished(true);
    progress.setValue(1);
  }, [progress]);

  useEffect(() => {
    const endSubscription = player.addListener('playToEnd', revealPrompt);
    const progressSubscription = player.addListener('timeUpdate', ({ currentTime }) => {
      if (player.duration > 0) progress.setValue(Math.min(currentTime / player.duration, 1));
    });
    const statusSubscription = player.addListener('statusChange', ({ status }) => {
      if (status === 'error') {
        setVideoFailed(true);
        revealPrompt();
      }
    });

    const fallbackTimer = setTimeout(revealPrompt, 12_000);
    return () => {
      clearTimeout(fallbackTimer);
      endSubscription.remove();
      progressSubscription.remove();
      statusSubscription.remove();
    };
  }, [player, progress, revealPrompt]);

  useEffect(() => {
    if (motionPreference === null || videoFinished) return;
    if (reduceMotion) {
      player.pause();
      revealPrompt();
      return;
    }

    try {
      player.play();
    } catch {
      setVideoFailed(true);
      revealPrompt();
    }
  }, [motionPreference, player, reduceMotion, revealPrompt, videoFinished]);

  useEffect(() => {
    if (!videoFinished) return undefined;

    if (reduceMotion) {
      promptOpacity.setValue(1);
      promptY.setValue(0);
      return undefined;
    }

    Animated.parallel([
      Animated.timing(promptOpacity, {
        duration: 360,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.spring(promptY, {
        damping: 18,
        mass: 0.8,
        stiffness: 150,
        toValue: 0,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();

    const arrowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(arrowY, { duration: 620, easing: Easing.inOut(Easing.quad), toValue: -6, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(arrowY, { duration: 620, easing: Easing.inOut(Easing.quad), toValue: 0, useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    );
    arrowLoop.start();
    return () => arrowLoop.stop();
  }, [arrowY, promptOpacity, promptY, reduceMotion, videoFinished]);

  const exitSplash = useCallback(() => {
    if (isExiting.current) return;
    isExiting.current = true;

    if (reduceMotion) {
      onComplete();
      return;
    }

    Animated.timing(dragY, {
      duration: 460,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      toValue: -height - 48,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start(({ finished }) => {
      if (finished) onComplete();
    });
  }, [dragY, height, onComplete, reduceMotion]);

  useEffect(() => {
    if (continueRequested && appReady) exitSplash();
  }, [appReady, continueRequested, exitSplash]);

  const requestContinue = useCallback(() => {
    if (!videoFinished || continueRequested) return;
    setContinueRequested(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);

    if (appReady) {
      exitSplash();
      return;
    }

    Animated.spring(dragY, {
      damping: 18,
      stiffness: 180,
      toValue: -24,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [appReady, continueRequested, dragY, exitSplash, videoFinished]);

  const resetDrag = useCallback(() => {
    Animated.spring(dragY, {
      damping: 18,
      stiffness: 180,
      toValue: 0,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [dragY]);

  const swipeGesture = useMemo(
    () => Gesture.Pan()
      .enabled(videoFinished && !continueRequested)
      .activeOffsetY([-12, 12])
      .failOffsetX([-48, 48])
      .onUpdate(({ translationY }) => {
        if (translationY < 0) dragY.setValue(Math.max(translationY, -180));
      })
      .onEnd(({ translationY, velocityY }) => {
        if (translationY <= -SWIPE_DISTANCE || velocityY <= SWIPE_VELOCITY) requestContinue();
        else resetDrag();
      })
      .runOnJS(true),
    [continueRequested, dragY, requestContinue, resetDrag, videoFinished],
  );

  const screenOpacity = dragY.interpolate({
    inputRange: [-Math.max(height, 1), -120, 0],
    outputRange: [0, 0.82, 1],
    extrapolate: 'clamp',
  });

  return (
    <GestureDetector gesture={swipeGesture}>
      <Animated.View
        accessibilityViewIsModal
        style={[styles.root, { opacity: screenOpacity, transform: [{ translateY: dragY }] }]}
      >
        {motionPreference === false && !videoFailed ? (
          <VideoView
            allowsPictureInPicture={false}
            contentFit="cover"
            nativeControls={false}
            onFirstFrameRender={() => setVideoReady(true)}
            player={player}
            playsInline
            style={StyleSheet.absoluteFill}
            surfaceType="textureView"
            useExoShutter={false}
          />
        ) : null}

        {(!videoReady || reduceMotion || videoFailed) ? (
          <LinearGradient colors={['#170E0B', '#2B1711', '#120A08']} style={styles.staticBackdrop}>
            <View style={styles.logoCard}>
              <BrandLogo width={210} />
            </View>
          </LinearGradient>
        ) : null}

        <LinearGradient
          colors={videoFinished
            ? ['rgba(13,8,6,0.14)', 'rgba(13,8,6,0.05)', 'rgba(13,8,6,0.34)', 'rgba(13,8,6,0.94)']
            : ['rgba(13,8,6,0.18)', 'transparent', 'rgba(13,8,6,0.28)']}
          locations={videoFinished ? [0, 0.43, 0.66, 1] : [0, 0.62, 1]}
          style={[StyleSheet.absoluteFill, styles.pointerNone]}
        />

        {!videoFinished ? (
          <View style={[styles.progressArea, styles.pointerNone, { bottom: Math.max(insets.bottom, 16) + 20 }]}>
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, { transform: [{ scaleX: progress }] }]} />
            </View>
            <Text style={styles.loadingText}>MEMPERSIAPKAN PENGALAMAN</Text>
          </View>
        ) : null}

        {videoFinished ? (
          <Animated.View
            style={[
              styles.promptArea,
              { bottom: Math.max(insets.bottom, 16) + 18, opacity: promptOpacity, transform: [{ translateY: promptY }] },
            ]}
          >
            <View style={styles.eyebrow}>
              <Sparkles color="#F4CB7A" size={14} strokeWidth={2} />
              <Text style={styles.eyebrowText}>DONAT DANKAU POS</Text>
            </View>
            <Text accessibilityRole="header" style={styles.title}>Siap untuk melayani.</Text>
            <Text style={styles.subtitle}>Semua yang Anda butuhkan, dalam satu sentuhan.</Text>

            <Pressable
              accessibilityHint="Geser ke atas atau ketuk untuk membuka aplikasi"
              accessibilityLabel="Lanjutkan ke aplikasi"
              accessibilityRole="button"
              disabled={continueRequested}
              onPress={requestContinue}
              style={({ pressed }) => [styles.swipeButton, pressed && styles.swipeButtonPressed]}
            >
              <BlurView intensity={38} style={styles.swipeGlass} tint="dark">
                <View style={styles.swipeIconShell}>
                  {continueRequested ? (
                    <ActivityIndicator color={palette.cocoaDark} size="small" />
                  ) : (
                    <Animated.View style={{ transform: [{ translateY: arrowY }] }}>
                      <ChevronsUp color={palette.cocoaDark} size={24} strokeWidth={2.2} />
                    </Animated.View>
                  )}
                </View>
                <View style={styles.swipeCopy}>
                  <Text style={styles.swipeTitle}>{continueRequested ? 'Menyiapkan outlet…' : 'Geser ke atas'}</Text>
                  <Text style={styles.swipeSubtitle}>{continueRequested ? 'Hampir selesai' : 'atau ketuk untuk melanjutkan'}</Text>
                </View>
                <View style={styles.swipeAccent} />
              </BlurView>
            </Pressable>
          </Animated.View>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1000,
    backgroundColor: '#140D0A',
    overflow: 'hidden',
  },
  staticBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointerNone: { pointerEvents: 'none' },
  logoCard: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
  },
  progressArea: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  progressTrack: {
    width: 72,
    height: 3,
    overflow: 'hidden',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  progressFill: {
    width: '100%',
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: '#F4CB7A',
    transformOrigin: 'left center',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.78)',
    fontFamily: type.bold,
    fontSize: 9,
    letterSpacing: 1.8,
  },
  promptArea: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
  },
  eyebrow: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
  },
  eyebrowText: {
    color: '#FFE9BC',
    fontFamily: type.bold,
    fontSize: 9,
    letterSpacing: 1.4,
  },
  title: {
    marginTop: spacing.md,
    color: palette.white,
    fontFamily: type.display,
    fontSize: 34,
    lineHeight: 41,
    textAlign: 'center',
  },
  subtitle: {
    maxWidth: 330,
    marginTop: spacing.xs,
    color: 'rgba(255,255,255,0.78)',
    fontFamily: type.medium,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  swipeButton: {
    width: '100%',
    maxWidth: 430,
    minHeight: 76,
    marginTop: spacing.lg,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
  },
  swipeButtonPressed: { opacity: 0.82 },
  swipeGlass: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    backgroundColor: 'rgba(31,19,15,0.52)',
  },
  swipeIconShell: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: '#F6D58F',
  },
  swipeCopy: { flex: 1, paddingHorizontal: spacing.md },
  swipeTitle: { color: palette.white, fontFamily: type.bold, fontSize: 14 },
  swipeSubtitle: { marginTop: 3, color: 'rgba(255,255,255,0.62)', fontFamily: type.medium, fontSize: 10 },
  swipeAccent: { width: 4, height: 30, borderRadius: radius.pill, backgroundColor: '#F2C66F' },
});
