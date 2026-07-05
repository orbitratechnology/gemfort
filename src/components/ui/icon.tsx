import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { useAppTheme } from '@/hooks/use-app-theme';

export type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
};

/**
 * App-wide icon. Wraps react-native-vector-icons (via @expo/vector-icons)
 * MaterialIcons set, which maps 1:1 to the Material Symbols used in the
 * GemFort stitch designs. Defaults to the current theme's on-surface color.
 */
export function Icon({ name, size = 24, color }: IconProps) {
  const { colors } = useAppTheme();
  return <MaterialIcons name={name} size={size} color={color ?? colors.onSurface} />;
}
