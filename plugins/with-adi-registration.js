const { withDangerousMod } = require("expo/config-plugins");
const fs = require("node:fs/promises");
const path = require("node:path");

module.exports = function withAdiRegistration(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const source = path.join(
        config.modRequest.projectRoot,
        "assets",
        "adi-registration.properties",
      );

      const destination = path.join(
        config.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "assets",
        "adi-registration.properties",
      );

      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.copyFile(source, destination);

      return config;
    },
  ]);
};
