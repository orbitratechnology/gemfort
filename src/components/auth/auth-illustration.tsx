import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";


type AuthIllustrationProps = {
  /** Logo box size in dp. Default 120. */
  size?: number;
};

/** Transparent GemFort mark as the auth hero. */
export function AuthIllustration({ size = 120 }: AuthIllustrationProps) {
  return (
    <View
      style={styles.wrap}
      accessibilityRole="image"
      accessibilityLabel="GemFort"
    >
      <Image
        source={require("@/assets/images/icon-transparent.png")}
        style={{ width: size, height: size }}
        contentFit="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
});
