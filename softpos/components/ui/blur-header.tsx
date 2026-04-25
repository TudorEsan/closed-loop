import { type ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

export const BLUR_HEADER_HEIGHT = 52;

type BlurHeaderProps = {
  scrollY: SharedValue<number>;
  title?: string;
  left?: ReactNode;
  right?: ReactNode;
  threshold?: number;
  tint?: 'light' | 'dark' | 'default';
};

export function BlurHeader({
  scrollY,
  title,
  left,
  right,
  threshold = 24,
  tint = 'light',
}: BlurHeaderProps) {
  const insets = useSafeAreaInsets();

  const blurProps = useAnimatedProps(() => ({
    intensity: interpolate(
      scrollY.value,
      [0, threshold],
      [0, Platform.OS === 'ios' ? 80 : 60],
      Extrapolation.CLAMP,
    ),
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, threshold],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const borderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [threshold * 0.5, threshold],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [threshold * 0.4, threshold],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [threshold * 0.4, threshold],
          [6, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <AnimatedBlurView
        animatedProps={blurProps}
        tint={tint}
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.fallback, overlayStyle]}
      />
      <View style={[styles.row, { height: BLUR_HEADER_HEIGHT }]}>
        <View style={styles.side}>{left}</View>
        <Animated.View style={[styles.titleWrap, titleStyle]}>
          {title ? (
            <Text numberOfLines={1} style={styles.title}>
              {title}
            </Text>
          ) : null}
        </Animated.View>
        <View style={[styles.side, styles.sideRight]}>{right}</View>
      </View>
      <Animated.View style={[styles.border, borderStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    overflow: 'hidden',
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  side: {
    minWidth: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0a0a0a',
  },
  border: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
});
