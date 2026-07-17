import { FontAwesome6 } from '@react-native-vector-icons/fontawesome6/static';
import { MaterialIcons } from '@react-native-vector-icons/material-icons/static';

import { useAppTheme } from '@/hooks/use-app-theme';

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

/** Material Icons plus Font Awesome aliases used in GemFort. */
export type IconName = MaterialIconName | 'money-check-dollar' | 'whatsapp';

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
};

/**
 * App-wide icon. Material Symbols by default; FA6 for cheque + WhatsApp brand.
 */
export function Icon({ name, size = 24, color }: IconProps) {
  const { colors } = useAppTheme();
  const resolved = color ?? colors.onSurface;

  if (name === 'money-check-dollar') {
    return (
      <FontAwesome6
        name="money-check-dollar"
        iconStyle="solid"
        size={size}
        color={resolved}
      />
    );
  }

  if (name === 'whatsapp') {
    return (
      <FontAwesome6
        name="whatsapp"
        iconStyle="brand"
        size={size}
        color={resolved}
      />
    );
  }

  return <MaterialIcons name={name} size={size} color={resolved} />;
}
