import { Button } from 'heroui-native';

type Props = {
  onPress?: () => void;
  isDisabled?: boolean;
  children?: string;
};

export function LiquidButton({ onPress, isDisabled, children }: Props) {
  return (
    <Button
      onPress={onPress}
      isDisabled={isDisabled}
      size="lg"
      className="rounded-full bg-foreground"
    >
      <Button.Label className="text-white">{children ?? ''}</Button.Label>
    </Button>
  );
}
