import { useEffect } from 'react';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export function NfcPulse({ active }: { active: boolean }) {
  return (
    <>
      <PulseRing active={active} delay={0} />
      <PulseRing active={active} delay={500} />
      <PulseRing active={active} delay={1000} />
    </>
  );
}

function PulseRing({ active, delay }: { active: boolean; delay: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (active) {
      progress.value = 0;
      progress.value = withDelay(
        delay,
        withRepeat(
          withTiming(1, { duration: 1500, easing: Easing.out(Easing.ease) }),
          -1,
          false,
        ),
      );
    } else {
      cancelAnimation(progress);
      progress.value = withTiming(0, { duration: 200 });
    }
    return () => {
      cancelAnimation(progress);
    };
  }, [active, delay, progress]);

  const style = useAnimatedStyle(() => {
    const scale = 1 + progress.value * 1.4;
    const opacity = active ? (1 - progress.value) * 0.55 : 0;
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: 128,
          height: 128,
          borderRadius: 64,
          borderWidth: 2,
          borderColor: '#ffffff',
        },
        style,
      ]}
    />
  );
}
