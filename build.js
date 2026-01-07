#!/usr/bin/env node
/**
 * DreamShop Build Script
 * Combines partials into a single index.html for deployment
 *
 * Usage: node build.js
 *
 * Looks for <!-- include:path/to/file.html --> markers in src/index.html
 * and replaces them with the contents of the referenced files.
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'src');
const DIST_DIR = path.join(__dirname, 'dist');
const TEMPLATE = path.join(SRC_DIR, 'index.html');

// Ensure dist directory exists
if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

// Read template
let html = fs.readFileSync(TEMPLATE, 'utf8');

// Find all includes first
const includeRegex = /<!--\s*include:([^\s]+)\s*-->/g;
const includes = [];
let match;

while ((match = includeRegex.exec(html)) !== null) {
  includes.push({
    placeholder: match[0],
    filePath: match[1]
  });
}

// Replace each include
// Note: We use a replacer function to avoid issues with $ in replacement strings
for (const inc of includes) {
  const includePath = path.join(SRC_DIR, inc.filePath);

  if (!fs.existsSync(includePath)) {
    console.error(`Error: Include file not found: ${includePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(includePath, 'utf8');
  // Use a function as replacer to avoid $ being treated as special
  html = html.replace(inc.placeholder, () => content);
}

// Write output
const outputPath = path.join(DIST_DIR, 'index.html');
fs.writeFileSync(outputPath, html);

// Copy static assets to dist
const staticFiles = ['config.js', 'icon.png'];
for (const file of staticFiles) {
  const src = path.join(__dirname, file);
  const dest = path.join(DIST_DIR, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
}

console.log('Build complete!');
console.log(`  Output: ${outputPath}`);
console.log(`  Size: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`);
