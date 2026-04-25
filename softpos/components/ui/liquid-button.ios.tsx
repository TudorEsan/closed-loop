import { Button, Text, Host } from "@expo/ui/swift-ui";

type Props = {
  onPress?: () => void;
  isDisabled?: boolean;
  children?: string;
};

export function LiquidButton({ onPress, isDisabled, children }: Props) {
  return (
    <Host matchContents>
      <Button
        onPress={onPress}
        disabled={isDisabled}
        variant="glassProminent"
        style={{ minHeight: 48, minWidth: 140 }}
      >
        <Text>{children ?? ""}</Text>
      </Button>
    </Host>
  );
}
