#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

// Parameters
const collectionDir = process.argv[2];
if (!collectionDir) {
  console.error("Please provide a collection directory path");
  process.exit(1);
}

const imagesDir = path.join(collectionDir, "assets", "images");
if (!fs.existsSync(imagesDir)) {
  console.error("Images directory does not exist:", imagesDir);
  process.exit(1);
}

// Create a banner image (1400x350)
console.log("Creating banner.png...");
sharp({
  create: {
    width: 1400,
    height: 350,
    channels: 4,
    background: { r: 30, g: 58, b: 138, alpha: 1 }, // Dark blue
  },
})
  .composite([
    {
      input:
        Buffer.from(`<svg width="1400" height="350" xmlns="http://www.w3.org/2000/svg">
      <text x="700" y="175" font-family="Arial" font-size="72" text-anchor="middle" fill="white">Collection Banner</text>
    </svg>`),
      top: 0,
      left: 0,
    },
  ])
  .png()
  .toFile(path.join(imagesDir, "banner.png"));

// Create a logo image (500x500)
console.log("Creating logo.png...");
sharp({
  create: {
    width: 500,
    height: 500,
    channels: 4,
    background: { r: 0, g: 128, b: 255, alpha: 1 }, // Blue
  },
})
  .composite([
    {
      input:
        Buffer.from(`<svg width="500" height="500" xmlns="http://www.w3.org/2000/svg">
      <circle cx="250" cy="250" r="200" fill="white" opacity="0.2"/>
      <text x="250" y="250" font-family="Arial" font-size="48" text-anchor="middle" fill="white">Logo</text>
    </svg>`),
      top: 0,
      left: 0,
    },
  ])
  .png()
  .toFile(path.join(imagesDir, "logo.png"));

// Create three NFT images (1024x1024)
const nftColors = [
  { r: 100, g: 149, b: 237, alpha: 1 }, // Cornflower blue
  { r: 65, g: 105, b: 225, alpha: 1 }, // Royal blue
  { r: 0, g: 191, b: 255, alpha: 1 }, // Deep sky blue
];

for (let i = 1; i <= 3; i++) {
  console.log(`Creating shark-${i}.png...`);
  const color = nftColors[i - 1];

  sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: color,
    },
  })
    .composite([
      {
        input:
          Buffer.from(`<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
        <path d="M512,300 C600,250 700,300 750,400 C800,500 750,600 700,650 L750,700 L700,750 L650,700 C600,750 500,800 400,750 C300,700 200,600 250,450 C300,300 424,350 512,300 Z" fill="white" opacity="0.7"/>
        <circle cx="400" cy="400" r="20" fill="black"/>
        <path d="M500,500 C550,500 600,520 600,550 C600,580 550,600 500,600 C450,600 400,580 400,550 C400,520 450,500 500,500 Z" fill="black"/>
        <text x="512" y="800" font-family="Arial" font-size="72" text-anchor="middle" fill="white">Shark ${i}</text>
      </svg>`),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toFile(path.join(imagesDir, `shark-${i}.png`));
}

console.log("Placeholder images created successfully!");
