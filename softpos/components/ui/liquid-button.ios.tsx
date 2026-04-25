import { Button } from '@expo/ui/swift-ui';

type Props = {
  onPress?: () => void;
  isDisabled?: boolean;
  children?: string;
};

export function LiquidButton({ onPress, isDisabled, children }: Props) {
  return (
    <Button variant="prominent" onPress={onPress} disabled={isDisabled}>
      {children ?? ''}
    </Button>
  );
}
