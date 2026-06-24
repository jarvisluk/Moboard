const { execSync } = require('child_process');
const path = require('path');

/**
 * electron-builder afterSign hook.
 * - If electron-builder is configured to use a real Developer ID identity (CSC_NAME/APPLE_CODE_SIGN_IDENTITY),
 *   it already signs the app and we keep that signature.
 * - Otherwise fall back to ad-hoc signing so local/manual builds can still be opened on Apple Silicon.
 */
exports.default = async function afterSign(context) {
    const { appOutDir, packager } = context;
    const appName = packager.appInfo.productFilename;
    const appPath = path.join(appOutDir, `${appName}.app`);

    const hasOfficialIdentity =
        process.env.CSC_NAME ||
        process.env.APPLE_CODE_SIGN_IDENTITY ||
        process.env.CSC_LINK ||
        process.env.DEVELOPER_ID_SIGNING_IDENTITY;

    if (hasOfficialIdentity) {
        console.log('[afterSign] Skipping ad-hoc signing because official identity env vars are present.');
        return;
    }

    console.log(`\n[afterSign] Using ad-hoc signing: ${appPath}`);
    try {
        execSync(`codesign --sign - --force --deep "${appPath}"`, { stdio: 'inherit' });
        console.log('[afterSign] Ad-hoc signing complete.\n');
    } catch (err) {
        console.error('[afterSign] codesign failed:', err.message);
        throw err;
    }
};
