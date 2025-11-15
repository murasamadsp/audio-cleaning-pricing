// Test script for Audio Cleaning Pricing Calculator
// Run with: node test.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Testing Audio Cleaning Pricing Calculator...\n');

// Test 1: Check if all files exist
console.log('1. Checking file structure...');
const requiredFiles = [
  'index.html',
  'src/main.js',
  'src/style.css',
  'package.json',
  'vite.config.js'
];

let allFilesExist = true;
requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ❌ ${file} - MISSING`);
    allFilesExist = false;
  }
});

// Test 2: Check package.json
console.log('\n2. Checking package.json...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const requiredScripts = ['dev', 'build', 'preview'];
  const scriptsExist = requiredScripts.every(script => packageJson.scripts[script]);

  if (scriptsExist) {
    console.log('   ✅ All required scripts present');
  } else {
    console.log('   ❌ Missing some scripts');
  }

  const requiredDeps = ['vite', 'modern-normalize', 'chart.js'];
  const depsExist = requiredDeps.every(dep =>
    packageJson.dependencies && packageJson.dependencies[dep] ||
    packageJson.devDependencies && packageJson.devDependencies[dep]
  );

  if (depsExist) {
    console.log('   ✅ All required dependencies present');
  } else {
    console.log('   ❌ Missing some dependencies');
  }
} catch (error) {
  console.log('   ❌ Error reading package.json:', error.message);
}

// Test 3: Check HTML structure
console.log('\n3. Checking HTML structure...');
try {
  const html = fs.readFileSync('index.html', 'utf8');

  const checks = [
    { name: 'DOCTYPE', pattern: /<!DOCTYPE html>/i },
    { name: 'HTML lang attribute', pattern: /<html lang="uk">/i },
    { name: 'Meta charset', pattern: /<meta charset="UTF-8"/i },
    { name: 'Meta viewport', pattern: /<meta name="viewport"/i },
    { name: 'Title', pattern: /<title>.*Калькулятор.*<\/title>/i },
    { name: 'Chart.js script', pattern: /cdn\.jsdelivr\.net\/npm\/chart\.js/i },
    { name: 'Main script', pattern: /<script type="module" src="\/src\/main\.js"><\/script>/i },
    { name: 'Price chart canvas', pattern: /id="priceChart"/i },
    { name: 'Minutes slider', pattern: /id="minutesSlider"/i }
  ];

  checks.forEach(check => {
    if (check.pattern.test(html)) {
      console.log(`   ✅ ${check.name}`);
    } else {
      console.log(`   ❌ ${check.name}`);
    }
  });
} catch (error) {
  console.log('   ❌ Error reading HTML:', error.message);
}

// Test 4: Check JavaScript structure
console.log('\n4. Checking JavaScript structure...');
try {
  const js = fs.readFileSync('src/main.js', 'utf8');

  const checks = [
    { name: 'CSS import', pattern: /import "\.\/style\.css"/ },
    { name: 'Chart.js integration', pattern: /new Chart\(/ },
    { name: 'DOM ready event', pattern: /DOMContentLoaded/ },
    { name: 'Health check function', pattern: /function healthCheck/ },
    { name: 'Error handling', pattern: /addEventListener\("error"/ },
    { name: 'Fetch API usage', pattern: /fetch\(/ },
    { name: 'Currency conversion', pattern: /formatCurrency/ }
  ];

  checks.forEach(check => {
    if (check.pattern.test(js)) {
      console.log(`   ✅ ${check.name}`);
    } else {
      console.log(`   ❌ ${check.name}`);
    }
  });
} catch (error) {
  console.log('   ❌ Error reading JavaScript:', error.message);
}

// Test 5: Check CSS structure
console.log('\n5. Checking CSS structure...');
try {
  const css = fs.readFileSync('src/style.css', 'utf8');

  const checks = [
    { name: 'Modern normalize import', pattern: /modern-normalize/ },
    { name: 'CSS custom properties', pattern: /--color-/ },
    { name: 'Dark mode support', pattern: /prefers-color-scheme.*dark/ },
    { name: 'Mobile responsive', pattern: /max-width.*767px/ },
    { name: 'Chart container styles', pattern: /\.chart-container/ },
    { name: 'Accessibility focus', pattern: /focus-visible/ },
    { name: 'Reduced motion', pattern: /prefers-reduced-motion/ }
  ];

  checks.forEach(check => {
    if (check.pattern.test(css)) {
      console.log(`   ✅ ${check.name}`);
    } else {
      console.log(`   ❌ ${check.name}`);
    }
  });
} catch (error) {
  console.log('   ❌ Error reading CSS:', error.message);
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('📋 TEST SUMMARY');
console.log('='.repeat(50));

if (allFilesExist) {
  console.log('✅ All required files are present');
} else {
  console.log('❌ Some files are missing');
}

console.log('\n🚀 Next steps:');
console.log('   1. Run: npm run dev');
console.log('   2. Open: http://localhost:3000');
console.log('   3. Check browser console for health check results');
console.log('   4. Test all interactive features');

console.log('\n🔧 Build test:');
console.log('   Run: npm run build');
console.log('   Check: dist/ folder should be created');

console.log('\n✨ Project is ready for development!');
