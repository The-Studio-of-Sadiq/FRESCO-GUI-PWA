import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function generateIcons() {
  const svgPath = path.join(process.cwd(), 'public', 'favicon.svg');
  const publicDir = path.join(process.cwd(), 'public');

  if (!fs.existsSync(svgPath)) {
    console.error('favicon.svg not found!');
    process.exit(1);
  }

  const svgBuffer = fs.readFileSync(svgPath);

  console.log('Generating PWA and favicon image formats...');

  // 1. favicon.ico (32x32 PNG inside ICO or standard PNG favicon)
  await sharp(svgBuffer)
    .resize(32, 32)
    .toFormat('png')
    .toFile(path.join(publicDir, 'favicon.ico'));

  // 2. apple-touch-icon.png (180x180)
  await sharp(svgBuffer)
    .resize(180, 180)
    .toFormat('png')
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));

  // 3. icon-192.png (192x192)
  await sharp(svgBuffer)
    .resize(192, 192)
    .toFormat('png')
    .toFile(path.join(publicDir, 'icon-192.png'));

  // 4. icon-512.png (512x512)
  await sharp(svgBuffer)
    .resize(512, 512)
    .toFormat('png')
    .toFile(path.join(publicDir, 'icon-512.png'));

  // 5. maskable-icon-512.png (512x512 with padding for PWA maskable)
  await sharp(svgBuffer)
    .resize(400, 400)
    .extend({
      top: 56,
      bottom: 56,
      left: 56,
      right: 56,
      background: '#0B132B'
    })
    .toFormat('png')
    .toFile(path.join(publicDir, 'maskable-icon-512.png'));

  console.log('Successfully generated all icons!');
}

generateIcons().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
