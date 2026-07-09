import { MaterialIcons } from '@react-native-vector-icons/material-icons/static';

import { useAppTheme } from '@/hooks/use-app-theme';

export type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
};

/**
 * App-wide icon using @react-native-vector-icons/material-icons.
 * Maps 1:1 to Material Symbols used across GemFort screens.
 */
export function Icon({ name, size = 24, color }: IconProps) {
  const { colors } = useAppTheme();
  return <MaterialIcons name={name} size={size} color={color ?? colors.onSurface} />;
}
