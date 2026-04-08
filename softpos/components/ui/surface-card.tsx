import { View, type ViewProps } from 'react-native';

type SurfaceCardProps = ViewProps & {
  noPadding?: boolean;
};

// White rounded card. Used for the transactions list container and similar.
export function SurfaceCard({
  children,
  className,
  noPadding,
  ...rest
}: SurfaceCardProps) {
  return (
    <View
      className={`rounded-2xl bg-app-surface shadow-sm ${
        noPadding ? '' : 'p-4'
      } ${className ?? ''}`}
      {...rest}
    >
      {children}
    </View>
  );
}
