const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin that copies adi-registration.properties to android/app/src/main/assets/
 * so Google Play Console can verify the ADI registration token.
 */
function withAdiRegistration(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const sourceFile = path.join(config.modRequest.platformProjectRoot, '..', 'assets', 'adi-registration.properties');
      const assetsDir = path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'main', 'assets');
      const destFile = path.join(assetsDir, 'adi-registration.properties');

      if (!fs.existsSync(sourceFile)) {
        throw new Error(`adi-registration.properties not found at ${sourceFile}`);
      }

      fs.mkdirSync(assetsDir, { recursive: true });
      fs.copyFileSync(sourceFile, destFile);
      console.log(`✓ Copied adi-registration.properties to ${destFile}`);

      return config;
    },
  ]);
}

module.exports = withAdiRegistration;
