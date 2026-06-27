const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const svgPath = path.join(root, 'assets', 'app-icon.svg');
const iconsetDir = path.join(root, 'assets', 'app-icon.iconset');

const iconsetSizes = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024],
];

function renderPng(size) {
  return sharp(svgPath)
    .resize(size, size)
    .png()
    .toBuffer();
}

function writeUInt32BE(buffer, value, offset) {
  buffer.writeUInt32BE(value, offset);
}

function makeIcns(entries) {
  const totalLength = 8 + entries.reduce((sum, entry) => sum + 8 + entry.data.length, 0);
  const output = Buffer.alloc(totalLength);
  output.write('icns', 0, 4, 'ascii');
  writeUInt32BE(output, totalLength, 4);

  let offset = 8;
  for (const entry of entries) {
    output.write(entry.type, offset, 4, 'ascii');
    writeUInt32BE(output, entry.data.length + 8, offset + 4);
    entry.data.copy(output, offset + 8);
    offset += entry.data.length + 8;
  }

  return output;
}

function makeIco(entries) {
  const headerLength = 6 + entries.length * 16;
  const totalLength = headerLength + entries.reduce((sum, entry) => sum + entry.data.length, 0);
  const output = Buffer.alloc(totalLength);

  output.writeUInt16LE(0, 0);
  output.writeUInt16LE(1, 2);
  output.writeUInt16LE(entries.length, 4);

  let imageOffset = headerLength;
  entries.forEach((entry, index) => {
    const offset = 6 + index * 16;
    output.writeUInt8(entry.size === 256 ? 0 : entry.size, offset);
    output.writeUInt8(entry.size === 256 ? 0 : entry.size, offset + 1);
    output.writeUInt8(0, offset + 2);
    output.writeUInt8(0, offset + 3);
    output.writeUInt16LE(1, offset + 4);
    output.writeUInt16LE(32, offset + 6);
    output.writeUInt32LE(entry.data.length, offset + 8);
    output.writeUInt32LE(imageOffset, offset + 12);
    entry.data.copy(output, imageOffset);
    imageOffset += entry.data.length;
  });

  return output;
}

async function main() {
  fs.mkdirSync(iconsetDir, { recursive: true });

  await Promise.all([
    renderPng(1024).then((data) => fs.writeFileSync(path.join(root, 'assets', 'app-icon.png'), data)),
    renderPng(512).then((data) => fs.writeFileSync(path.join(root, 'public', 'favicon.png'), data)),
    ...iconsetSizes.map(([name, size]) =>
      renderPng(size).then((data) => fs.writeFileSync(path.join(iconsetDir, name), data))
    ),
  ]);

  const icnsEntries = await Promise.all([
    ['icp4', 16],
    ['icp5', 32],
    ['icp6', 64],
    ['ic07', 128],
    ['ic08', 256],
    ['ic09', 512],
    ['ic10', 1024],
  ].map(async ([type, size]) => ({ type, data: await renderPng(size) })));
  fs.writeFileSync(path.join(root, 'assets', 'app-icon.icns'), makeIcns(icnsEntries));

  const icoEntries = await Promise.all([16, 32, 48, 64, 128, 256].map(async (size) => ({
    size,
    data: await renderPng(size),
  })));
  fs.writeFileSync(path.join(root, 'public', 'favicon.ico'), makeIco(icoEntries));

  console.log('Built app icons from assets/app-icon.svg');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
