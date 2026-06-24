const { execSync } = require('child_process');
const path = require('path');

/**
 * electron-builder afterSign hook
 * Applies ad hoc code signing (-) so macOS doesn't show "app is damaged"
 * on Apple Silicon Macs when distributed without a paid Developer ID.
 */
exports.default = async function afterSign(context) {
    const { appOutDir, packager } = context;
    const appName = packager.appInfo.productFilename;
    const appPath = path.join(appOutDir, `${appName}.app`);

    console.log(`\n[afterSign] Ad hoc signing: ${appPath}`);
    try {
        execSync(`codesign --sign - --force --deep "${appPath}"`, { stdio: 'inherit' });
        console.log('[afterSign] Ad hoc signing complete.\n');
    } catch (err) {
        console.error('[afterSign] codesign failed:', err.message);
        throw err;
    }
};
