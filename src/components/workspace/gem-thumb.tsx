import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { useAppTheme } from "@/hooks/use-app-theme";

type GemThumbProps = {
  uri?: string | null;
  label?: string;
  size?: number;
  /** Squared thumb (lists) vs slightly rounded. Default 10. */
  radius?: number;
};

/** Primary gem photo thumb with diamond fallback. */
export function GemThumb({
  uri,
  label = "Gem",
  size = 48,
  radius = 10,
}: GemThumbProps) {
  const { colors } = useAppTheme();

  if (uri) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          borderCurve: "continuous",
          overflow: "hidden",
        }}
      >
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          contentFit="cover"
          recyclingKey={uri}
          accessibilityLabel={`${label} photo`}
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: colors.surfaceContainerHigh,
        },
      ]}
      accessibilityLabel={`${label} photo placeholder`}
    >
      <Icon name="diamond" size={Math.round(size * 0.45)} color={colors.outlineVariant} />
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    borderCurve: "continuous",
  },
});
