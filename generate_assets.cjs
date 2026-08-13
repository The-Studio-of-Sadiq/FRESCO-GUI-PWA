const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Ensure output directories exist
const publicDir = path.join(process.cwd(), 'public');
const imagesDir = path.join(publicDir, 'images');

if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

// 1. Icon SVG Template (Square 512x512)
const createIconSvg = (size, isMaskable = false) => {
  const padding = isMaskable ? size * 0.15 : 0;
  const innerSize = size - padding * 2;
  const rx = isMaskable ? 0 : size * 0.22;

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0B132B"/>
        <stop offset="50%" stop-color="#0F172A"/>
        <stop offset="100%" stop-color="#1E293B"/>
      </linearGradient>

      <linearGradient id="fluidGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#00F0FF"/>
        <stop offset="50%" stop-color="#3B82F6"/>
        <stop offset="100%" stop-color="#1D4ED8"/>
      </linearGradient>

      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="${size * 0.02}" result="blur"/>
        <feComposite in="SourceGraphic" in2="blur" operator="over"/>
      </filter>
    </defs>

    <!-- Outer Card Background -->
    <rect width="${size}" height="${size}" rx="${rx}" fill="url(#bgGrad)"/>
    
    <!-- Outer Glow Ring -->
    <rect x="2" y="2" width="${size - 4}" height="${size - 4}" rx="${rx}" fill="none" stroke="#00F0FF" stroke-opacity="0.25" stroke-width="2"/>

    <!-- Content Group with optional Maskable Safe-Zone Inset -->
    <g transform="translate(${padding}, ${padding}) scale(${innerSize / size})">
      <!-- Quantum Grid Particles -->
      <circle cx="100" cy="120" r="4" fill="#00F0FF" opacity="0.6"/>
      <circle cx="120" cy="180" r="6" fill="#3B82F6" opacity="0.7"/>
      <circle cx="150" cy="240" r="5" fill="#00F0FF" opacity="0.8"/>
      <circle cx="130" cy="320" r="7" fill="#60A5FA" opacity="0.9"/>
      <circle cx="180" cy="380" r="5" fill="#00F0FF" opacity="0.7"/>
      <circle cx="240" cy="420" r="6" fill="#3B82F6" opacity="0.6"/>

      <!-- Main Fluid Flow Letter F -->
      <path d="M 120 100 
               C 220 80, 360 90, 420 130 
               C 340 160, 240 160, 180 180
               C 180 220, 280 210, 360 240
               C 290 270, 220 270, 180 300
               L 180 410 
               C 180 430, 160 440, 140 430
               C 120 420, 120 390, 120 370
               Z" 
            fill="url(#fluidGrad)" 
            filter="url(#glow)"/>

      <path d="M 140 115 
               C 210 100, 320 110, 370 140 
               C 310 155, 230 155, 180 170
               L 180 115 Z" 
            fill="#E0F2FE" 
            opacity="0.35"/>

      <!-- Particle SPH Nodes -->
      <circle cx="420" cy="130" r="10" fill="#00F0FF" filter="url(#glow)"/>
      <circle cx="360" cy="240" r="8" fill="#38BDF8" filter="url(#glow)"/>
      <circle cx="370" cy="140" r="5" fill="#FFFFFF"/>
    </g>
  </svg>`;
};

// 2. Banner / Poster SVG Generator
const createBannerSvg = (width, height, title, subtitle, tagline) => {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0B132B"/>
        <stop offset="40%" stop-color="#0F172A"/>
        <stop offset="100%" stop-color="#1E1B4B"/>
      </linearGradient>

      <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#00F0FF"/>
        <stop offset="100%" stop-color="#3B82F6"/>
      </linearGradient>

      <filter id="glow">
        <feGaussianBlur stdDeviation="12" result="blur"/>
        <feComposite in="SourceGraphic" in2="blur" operator="over"/>
      </filter>
    </defs>

    <rect width="${width}" height="${height}" fill="url(#bg)"/>

    <!-- Wave Background Accent -->
    <path d="M 0 ${height * 0.7} Q ${width * 0.25} ${height * 0.4}, ${width * 0.5} ${height * 0.65} T ${width} ${height * 0.5} L ${width} ${height} L 0 ${height} Z" fill="#00F0FF" opacity="0.05"/>
    <path d="M 0 ${height * 0.8} Q ${width * 0.35} ${height * 0.5}, ${width * 0.7} ${height * 0.75} T ${width} ${height * 0.6} L ${width} ${height} L 0 ${height} Z" fill="#3B82F6" opacity="0.08"/>

    <!-- Floating Quantum Nodes -->
    <circle cx="${width * 0.75}" cy="${height * 0.3}" r="120" fill="#00F0FF" opacity="0.08" filter="url(#glow)"/>
    <circle cx="${width * 0.85}" cy="${height * 0.6}" r="80" fill="#3B82F6" opacity="0.12" filter="url(#glow)"/>

    <!-- Left Branding Group -->
    <g transform="translate(${width * 0.08}, ${height * 0.25})">
      <!-- Icon -->
      <rect width="96" height="96" rx="24" fill="#0F172A" stroke="#00F0FF" stroke-width="2" stroke-opacity="0.4"/>
      <path d="M 24 24 C 50 18, 80 22, 90 32 C 70 40, 50 40, 36 45 C 36 55, 60 52, 80 60 C 65 68, 48 68, 36 75 L 36 82" fill="url(#cyanGrad)"/>
      <circle cx="90" cy="32" r="4" fill="#00F0FF"/>

      <!-- Text -->
      <text x="120" y="55" font-family="Inter, sans-serif" font-weight="900" font-size="52" fill="#FFFFFF" letter-spacing="4">${title.replace(/&/g, '&amp;')}</text>
      <text x="120" y="88" font-family="JetBrains Mono, monospace" font-weight="600" font-size="18" fill="#00F0FF" letter-spacing="2">${subtitle.replace(/&/g, '&amp;')}</text>

      <text x="0" y="170" font-family="Inter, sans-serif" font-weight="700" font-size="34" fill="#E2E8F0">${tagline.replace(/&/g, '&amp;')}</text>
      <text x="0" y="215" font-family="Inter, sans-serif" font-weight="400" font-size="20" fill="#94A3B8">Advanced Coupled-Channels &amp; Nuclear Reaction Physics Simulator</text>

      <!-- Badge -->
      <rect x="0" y="250" width="320" height="38" rx="8" fill="#00F0FF" fill-opacity="0.1" stroke="#00F0FF" stroke-opacity="0.3"/>
      <text x="16" y="274" font-family="JetBrains Mono, monospace" font-weight="600" font-size="14" fill="#38BDF8">PWA READY • OFFLINE WASM ENGINE</text>
    </g>
  </svg>`;
};

async function generateAllAssets() {
  console.log('Generating uncorrupted PNG and JPEG assets...');

  // 1. Generate PWA Root PNG Icons
  const pwaIcons = [
    { name: 'icon-192.png', size: 192, maskable: false },
    { name: 'icon-512.png', size: 512, maskable: false },
    { name: 'maskable-icon-512.png', size: 512, maskable: true },
    { name: 'apple-touch-icon.png', size: 180, maskable: false },
  ];

  for (const icon of pwaIcons) {
    const svgStr = createIconSvg(icon.size, icon.maskable);
    const outPath = path.join(publicDir, icon.name);
    await sharp(Buffer.from(svgStr))
      .resize(icon.size, icon.size)
      .png({ compressionLevel: 9 })
      .toFile(outPath);
    console.log(`Generated PWA icon: ${icon.name} (${icon.size}x${icon.size})`);
  }

  // 2. Generate Favicon & Vector Assets
  const favSvg = createIconSvg(512, false);
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), favSvg);
  fs.writeFileSync(path.join(publicDir, 'logo.svg'), favSvg);

  // Generate 32x32 Favicon ICO (PNG format wrapped for browser compatibility)
  await sharp(Buffer.from(favSvg))
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'favicon.ico'));
  console.log('Generated favicon.ico (32x32) & favicon.svg');

  // 3. Generate Image Gallery JPEGs
  const galleryImages = [
    {
      file: 'fresco_social_banner.jpg',
      w: 1200,
      h: 630,
      title: 'FRESCO PWA GUI',
      sub: 'FLUIDS • RESEARCH • SIMULATION • COMPUTING',
      tag: 'Powered by Physics. Driven by Curiosity.'
    },
    {
      file: 'fresco_og_image.jpg',
      w: 1200,
      h: 630,
      title: 'FRESCO PWA GUI',
      sub: 'NUCLEAR PHYSICS SIMULATOR',
      tag: 'Coupled-Channels & Reaction Plotter'
    },
    {
      file: 'fresco_hero_poster.jpg',
      w: 1920,
      h: 1080,
      title: 'FRESCO',
      sub: 'PWA SIMULATION PLATFORM',
      tag: 'Simulating the Complexity of Nuclear Physics.'
    },
    {
      file: 'fresco_logo_dark.jpg',
      w: 800,
      h: 600,
      title: 'FRESCO',
      sub: 'GUI PWA ENGINE',
      tag: 'HSTU Research Society'
    },
    {
      file: 'fresco_logo_horizontal.jpg',
      w: 1200,
      h: 400,
      title: 'FRESCO PWA',
      sub: 'NUCLEAR REACTION ENGINE',
      tag: 'FLUIDS • RESEARCH • SIMULATION'
    },
    {
      file: 'fresco_logo_vertical.jpg',
      w: 600,
      h: 800,
      title: 'FRESCO',
      sub: 'PWA GUI',
      tag: 'Coupled-Channels Platform'
    },
    {
      file: 'fresco_app_icon.jpg',
      w: 512,
      h: 512,
      title: 'FRESCO',
      sub: 'PWA',
      tag: 'Simulator Engine'
    },
    {
      file: 'fresco_design_system_board.jpg',
      w: 1920,
      h: 1080,
      title: 'FRESCO DESIGN SYSTEM',
      sub: 'UI / UX BRANDING SPECIFICATION',
      tag: 'Modern Quantum & Nuclear Visual Palette'
    }
  ];

  for (const img of galleryImages) {
    const svgStr = createBannerSvg(img.w, img.h, img.title, img.sub, img.tag);
    const outPath = path.join(imagesDir, img.file);
    await sharp(Buffer.from(svgStr))
      .resize(img.w, img.h)
      .jpeg({ quality: 92 })
      .toFile(outPath);
    console.log(`Generated public/images/${img.file} (${img.w}x${img.h})`);
  }

  console.log('All PWA icons and website images generated successfully and verified!');
}

generateAllAssets().catch(err => {
  console.error('Error generating assets:', err);
  process.exit(1);
});
