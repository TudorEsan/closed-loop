import { Pressable, Text, View } from 'react-native';

type ActionPillProps = {
  label: string;
  onPress?: () => void;
  variant?: 'light' | 'dark';
  disabled?: boolean;
};

// Button used for Add funds. Soft rounded rectangle by default, not a full
// pill. Light = white bg, dark = black bg.
export function ActionPill({
  label,
  onPress,
  variant = 'light',
  disabled,
}: ActionPillProps) {
  const isLight = variant === 'light';
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      className={`${disabled ? 'opacity-50' : 'active:opacity-80'}`}
    >
      <View
        className={`items-center rounded-xl py-3.5 ${
          isLight ? 'bg-app-surface' : 'bg-app-fg'
        }`}
      >
        <Text
          className={`text-base font-semibold ${
            isLight ? 'text-app-fg' : 'text-white'
          }`}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
