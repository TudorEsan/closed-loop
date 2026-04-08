import { Pressable, Text, View } from 'react-native';

type SectionHeaderProps = {
  title: string;
  actionLabel?: string;
  onActionPress?: () => void;
  center?: boolean;
};

export function SectionHeader({
  title,
  actionLabel,
  onActionPress,
  center,
}: SectionHeaderProps) {
  return (
    <View
      className={`mb-3 flex-row items-center ${
        center ? 'justify-center' : 'justify-between'
      }`}
    >
      <Text
        className={`text-[17px] font-semibold text-app-fg ${
          center ? 'flex-1 text-center' : ''
        }`}
      >
        {title}
      </Text>
      {actionLabel ? (
        <Pressable onPress={onActionPress} className="active:opacity-60">
          <Text className="text-[15px] font-medium text-app-link">
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
