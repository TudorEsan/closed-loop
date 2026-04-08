import { View, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Small wrapper around View that respects safe area insets and supports
// className via uniwind. We use this instead of SafeAreaView from
// react-native-safe-area-context because that one is not patched by uniwind
// so its className gets dropped.
type SafeScreenProps = ViewProps & {
  edges?: { top?: boolean; bottom?: boolean; left?: boolean; right?: boolean };
};

export function SafeScreen({
  children,
  className,
  style,
  edges = { top: true, bottom: true, left: true, right: true },
  ...rest
}: SafeScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className={className}
      style={[
        {
          flex: 1,
          paddingTop: edges.top ? insets.top : 0,
          paddingBottom: edges.bottom ? insets.bottom : 0,
          paddingLeft: edges.left ? insets.left : 0,
          paddingRight: edges.right ? insets.right : 0,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
