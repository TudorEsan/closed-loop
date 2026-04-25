import type { SFSymbol } from 'sf-symbols-typescript';
import { Button, Host } from '@expo/ui/swift-ui';
import {
  buttonStyle,
  controlSize,
  disabled,
  frame,
} from '@expo/ui/swift-ui/modifiers';

export type LiquidButtonProps = {
  onPress?: () => void;
  isDisabled?: boolean;
  label?: string;
  systemImage?: SFSymbol;
  minWidth?: number;
  minHeight?: number;
  size?: 'small' | 'regular' | 'large';
};

export function LiquidButton({
  onPress,
  isDisabled,
  label = '',
  systemImage,
  minWidth = 160,
  minHeight = 48,
  size = 'small',
}: LiquidButtonProps) {
  return (
    <Host matchContents>
      <Button
        onPress={onPress}
        label={label}
        systemImage={systemImage}
        modifiers={[
          buttonStyle('glass'),
          controlSize(size),
          frame({ minWidth, minHeight }),
          disabled(isDisabled ?? false),
        ]}
      />
    </Host>
  );
}
