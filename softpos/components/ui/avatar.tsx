import { Image, Text, View, type ImageSourcePropType } from 'react-native';

type AvatarProps = {
  source?: ImageSourcePropType | string | null;
  fallback?: string;
  size?: number;
  borderColor?: string;
};

// Circular avatar. Shows image if given, otherwise the first letter of fallback.
// Size is dynamic so we still keep it inline, the rest is classes.
export function Avatar({
  source,
  fallback = '?',
  size = 44,
  borderColor,
}: AvatarProps) {
  const initial = fallback.trim().charAt(0).toUpperCase() || '?';
  const imageSource: ImageSourcePropType | null =
    typeof source === 'string' ? { uri: source } : (source ?? null);
  return (
    <View
      className="items-center justify-center overflow-hidden bg-neutral-300"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: borderColor ? 2 : 0,
        borderColor,
      }}
    >
      {imageSource ? (
        <Image
          source={imageSource}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <Text
          className="font-bold text-app-fg"
          style={{ fontSize: size * 0.42 }}
        >
          {initial}
        </Text>
      )}
    </View>
  );
}
