import { FontAwesome6 } from '@react-native-vector-icons/fontawesome6/static';
import { MaterialIcons } from '@react-native-vector-icons/material-icons/static';
import { Image } from 'expo-image';

import {
  WORKSPACE_ENTITY_IMAGES,
  type WorkspaceEntityKind,
} from '@/constants/workspace-entity-images';
import { useAppTheme } from '@/hooks/use-app-theme';

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

/** Material Icons, entity artwork, and Font Awesome aliases used in GemFort. */
export type IconName =
  | MaterialIconName
  | 'money-check-dollar'
  | 'whatsapp'
  | WorkspaceEntityKind;

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
};

/**
 * App-wide icon. Material Symbols by default; entity names resolve to artwork.
 */
export function Icon({ name, size = 24, color }: IconProps) {
  const { colors } = useAppTheme();
  const resolved = color ?? colors.onSurface;
  const entityImage = WORKSPACE_ENTITY_IMAGES[name as WorkspaceEntityKind];

  if (entityImage) {
    return (
      <Image
        source={entityImage}
        style={{ width: size, height: size }}
        contentFit="contain"
        accessibilityIgnoresInvertColors
      />
    );
  }

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
