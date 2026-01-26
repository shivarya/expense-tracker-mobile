/**
 * Icon Generator for Google Play Store
 * 
 * This script generates all required icon sizes from SVG source files
 * Run: node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Check if dependencies are installed
try {
    require('sharp');
    require('@resvg/resvg-js');
} catch (err) {
    console.log('📦 Installing required dependencies...\n');
    execSync('npm install', { stdio: 'inherit', cwd: path.join(__dirname) });
    console.log('\n✅ Dependencies installed!\n');
}

const sharp = require('sharp');
const { Resvg } = require('@resvg/resvg-js');

// Paths
const ASSETS_DIR = path.join(__dirname, '..', 'assets', 'images');
const OUTPUT_DIR = path.join(__dirname, '..', 'play-store-assets');
const SVG_LOGO = path.join(ASSETS_DIR, 'app-logo.svg');
const SVG_ICON_SIMPLE = path.join(ASSETS_DIR, 'app-icon-modern.svg');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('🎨 Google Play Store Icon Generator\n');
console.log('==================================\n');

/**
 * Convert SVG to PNG using resvg-js
 */
async function convertSvgToPng(svgPath, outputPath, width, height = null) {
    const actualHeight = height || width;
    
    try {
        const svgBuffer = fs.readFileSync(svgPath);
        const resvg = new Resvg(svgBuffer, {
            fitTo: {
                mode: 'width',
                value: width
            }
        });
        
        const pngData = resvg.render();
        const pngBuffer = pngData.asPng();
        
        if (actualHeight !== width) {
            await sharp(pngBuffer)
                .resize(width, actualHeight)
                .toFile(outputPath);
        } else {
            fs.writeFileSync(outputPath, pngBuffer);
        }
        
        return true;
    } catch (err) {
        console.error(`   ❌ Error converting ${path.basename(svgPath)}:`, err.message);
        return false;
    }
}

/**
 * Generate app icon (512x512)
 */
async function generateAppIcon() {
    console.log('📱 Generating App Icon...');
    
    const tempPath = path.join(OUTPUT_DIR, 'temp-icon.png');
    const outputPath = path.join(OUTPUT_DIR, 'icon-512.png');
    
    const success = await convertSvgToPng(SVG_ICON_SIMPLE, tempPath, 800);
    
    if (success) {
        await sharp(tempPath)
            .resize(410, 410, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .extend({
                top: 51,
                bottom: 51,
                left: 51,
                right: 51,
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .png()
            .toFile(outputPath);
        
        fs.unlinkSync(tempPath);
        console.log(`   ✅ Created: icon-512.png (512x512 with transparent background)`);
        
        const assetsPath = path.join(ASSETS_DIR, 'icon.png');
        fs.copyFileSync(outputPath, assetsPath);
        console.log(`   ✅ Copied to: assets/images/icon.png`);
    }
    
    return success;
}

/**
 * Generate adaptive icons
 */
async function generateAdaptiveIcons() {
    console.log('\n📐 Generating Adaptive Icons...');
    
    const tempForeground = path.join(OUTPUT_DIR, 'temp-foreground.png');
    const foregroundPath = path.join(OUTPUT_DIR, 'adaptive-icon.png');
    let success = await convertSvgToPng(SVG_ICON_SIMPLE, tempForeground, 640);
    
    if (success) {
        await sharp(tempForeground)
            .resize(358, 358, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .extend({
                top: 77,
                bottom: 77,
                left: 77,
                right: 77,
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .png()
            .toFile(foregroundPath);
        
        fs.unlinkSync(tempForeground);
        console.log('   ✅ Adaptive icon (512x512 with transparent background)');
        fs.copyFileSync(foregroundPath, path.join(ASSETS_DIR, 'adaptive-icon.png'));
    }
}

/**
 * Generate splash screen
 */
async function generateSplashScreen() {
    console.log('\n🌅 Generating Splash Screen...');
    
    const outputPath = path.join(OUTPUT_DIR, 'splash-512.png');
    const success = await convertSvgToPng(SVG_LOGO, outputPath, 512);
    
    if (success) {
        console.log('   ✅ Splash icon (512x512)');
        fs.copyFileSync(outputPath, path.join(ASSETS_DIR, 'splash.png'));
    }
}

/**
 * Generate launcher icons
 */
async function generateLauncherIcons() {
    console.log('\n🚀 Generating Launcher Icons...');
    
    const sizes = [48, 72, 96, 144, 192, 512];
    
    for (const size of sizes) {
        const tempPath = path.join(OUTPUT_DIR, `temp-launcher-${size}.png`);
        const outputPath = path.join(OUTPUT_DIR, `launcher-icon-${size}.png`);
        const innerSize = Math.floor(size * 0.8);
        const padding = Math.floor((size - innerSize) / 2);
        
        const success = await convertSvgToPng(SVG_ICON_SIMPLE, tempPath, innerSize * 1.5);
        if (success) {
            await sharp(tempPath)
                .resize(innerSize, innerSize, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .extend({
                    top: padding,
                    bottom: padding,
                    left: padding,
                    right: padding,
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .png()
                .toFile(outputPath);
            
            fs.unlinkSync(tempPath);
            console.log(`   ✅ ${size}x${size}`);
        }
    }
}

/**
 * Generate web assets
 */
async function generateWebAssets() {
    console.log('\n🌐 Generating Web Assets...');
    
    const faviconSizes = [16, 32, 48];
    for (const size of faviconSizes) {
        const outputPath = path.join(OUTPUT_DIR, `favicon-${size}.png`);
        const success = await convertSvgToPng(SVG_ICON_SIMPLE, outputPath, size);
        if (success && size === 48) {
            fs.copyFileSync(outputPath, path.join(ASSETS_DIR, 'favicon.png'));
            console.log(`   ✅ Favicon ${size}x${size} (copied to assets)`);
        } else if (success) {
            console.log(`   ✅ Favicon ${size}x${size}`);
        }
    }
}

/**
 * Generate feature graphic
 */
async function generateFeatureGraphic() {
    console.log('\n🖼️  Generating Feature Graphic...');
    
    const featurePath = path.join(OUTPUT_DIR, 'feature-graphic.png');
    
    await sharp({
        create: {
            width: 1024,
            height: 500,
            channels: 4,
            background: '#1A237E'
        }
    })
    .png()
    .toFile(featurePath);
    
    console.log('   ✅ Feature Graphic (1024x500)');
    console.log('   ℹ️  Note: Add logo and text manually using image editor');
}

/**
 * Main execution
 */
async function main() {
    try {
        if (!fs.existsSync(SVG_LOGO)) {
            console.error('❌ SVG logo not found at:', SVG_LOGO);
            process.exit(1);
        }
        
        if (!fs.existsSync(SVG_ICON_SIMPLE)) {
            console.error('❌ Simple SVG icon not found at:', SVG_ICON_SIMPLE);
            process.exit(1);
        }
        
        await generateAppIcon();
        await generateAdaptiveIcons();
        await generateSplashScreen();
        await generateLauncherIcons();
        await generateWebAssets();
        await generateFeatureGraphic();
        
        console.log('\n✨ All assets generated successfully!');
        console.log(`📁 Output folder: ${OUTPUT_DIR}`);
        console.log('\n📋 Next Steps:');
        console.log('   1. Review generated assets in play-store-assets/');
        console.log('   2. Edit feature-graphic.png to add branding');
        console.log('   3. Run: npm run android to test');
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
}

main();
