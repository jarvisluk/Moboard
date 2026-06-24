const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sourceDir = path.join(root, 'public');
const outputDir = path.join(root, 'dist-pages');

function copyFile(relativeSource, relativeTarget = relativeSource) {
  const source = path.join(sourceDir, relativeSource);
  const target = path.join(outputDir, relativeTarget);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

copyFile('mobile.html', 'index.html');
copyFile('mobile.html');
copyFile('css/style.css');
copyFile('js/mobile.js');
copyFile('favicon.png');
copyFile('favicon.ico');

console.log(`Built mobile Pages output at ${path.relative(root, outputDir)}`);
