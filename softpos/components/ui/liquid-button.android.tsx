import { View } from 'react-native';
import { Button } from 'heroui-native';
import { Ionicons } from '@expo/vector-icons';

export type LiquidButtonProps = {
  onPress?: () => void;
  isDisabled?: boolean;
  label?: string;
  systemImage?: string;
  minWidth?: number;
  minHeight?: number;
  size?: 'small' | 'regular' | 'large';
};

const SIZE_MAP = {
  small: 'sm',
  regular: 'md',
  large: 'lg',
} as const;

const SF_TO_IONICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  plus: 'add',
};

export function LiquidButton({
  onPress,
  isDisabled,
  label,
  systemImage,
  size = 'small',
}: LiquidButtonProps) {
  const iconName = systemImage ? SF_TO_IONICON[systemImage] : undefined;

  return (
    <Button
      onPress={onPress}
      isDisabled={isDisabled}
      size={SIZE_MAP[size]}
      className="rounded-full bg-foreground"
    >
      <View className="flex-row items-center gap-2">
        {iconName ? (
          <Ionicons name={iconName} size={18} color="#ffffff" />
        ) : null}
        <Button.Label className="text-white">{label ?? ''}</Button.Label>
      </View>
    </Button>
  );
}
