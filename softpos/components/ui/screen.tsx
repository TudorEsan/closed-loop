import { View, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Full screen wrapper. Handles safe area padding. Background is transparent
// on purpose so a parent ImageBackground can show through. Set bg classes on
// the child if you want a solid color.
type ScreenProps = ViewProps & {
  edgeTop?: boolean;
  edgeBottom?: boolean;
};

export function Screen({
  children,
  style,
  edgeTop = true,
  edgeBottom = true,
  ...rest
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-1"
      style={[
        {
          paddingTop: edgeTop ? insets.top : 0,
          paddingBottom: edgeBottom ? insets.bottom : 0,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
