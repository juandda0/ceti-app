const fs = require('fs');
const path = require('path');

function convertToUtf8(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      convertToUtf8(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      const buffer = fs.readFileSync(fullPath);
      // Check for UTF-16LE BOM (FF FE)
      if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
        console.log(`Converting ${fullPath} from UTF-16LE to UTF-8`);
        const content = buffer.toString('utf16le');
        fs.writeFileSync(fullPath, content, 'utf8');
      }
    }
  }
}

convertToUtf8('./app');
convertToUtf8('./src');
console.log('Conversion complete!');
