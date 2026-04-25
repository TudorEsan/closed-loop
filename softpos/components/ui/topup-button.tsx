import { router } from 'expo-router';

import { LiquidButton } from './liquid-button';

type Props = {
  onPress?: () => void;
  isDisabled?: boolean;
};

export function TopupButton({ onPress, isDisabled }: Props) {
  return (
    <LiquidButton
      onPress={onPress ?? (() => router.push('/topup'))}
      isDisabled={isDisabled}
      label="Top-up"
      systemImage="plus"
    />
  );
}
