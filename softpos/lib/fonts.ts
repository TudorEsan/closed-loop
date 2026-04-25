import { Text, type TextStyle } from 'react-native';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';

export const dmSansFontMap = {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
};

const WEIGHT_TO_FAMILY: Record<string, string> = {
  '100': 'DMSans_400Regular',
  '200': 'DMSans_400Regular',
  '300': 'DMSans_400Regular',
  '400': 'DMSans_400Regular',
  normal: 'DMSans_400Regular',
  '500': 'DMSans_500Medium',
  '600': 'DMSans_600SemiBold',
  '700': 'DMSans_700Bold',
  '800': 'DMSans_700Bold',
  '900': 'DMSans_700Bold',
  bold: 'DMSans_700Bold',
};

function familyForWeight(weight?: TextStyle['fontWeight']): string {
  if (!weight) return 'DMSans_400Regular';
  return WEIGHT_TO_FAMILY[String(weight)] ?? 'DMSans_400Regular';
}

let patched = false;

export function applyDMSansAsDefault() {
  if (patched) return;
  patched = true;

  const TextAny = Text as unknown as {
    render: (...args: unknown[]) => unknown;
  };
  const originalRender = TextAny.render;

  TextAny.render = function patchedRender(...args: unknown[]) {
    const element = originalRender.apply(this, args) as {
      props: { style?: TextStyle | TextStyle[] };
    } & Record<string, unknown>;

    const flat = (Array.isArray(element.props.style)
      ? Object.assign({}, ...element.props.style.filter(Boolean))
      : element.props.style) as TextStyle | undefined;

    const fontFamily = flat?.fontFamily ?? familyForWeight(flat?.fontWeight);

    return {
      ...element,
      props: {
        ...element.props,
        style: [{ fontFamily }, element.props.style],
      },
    };
  };
}
