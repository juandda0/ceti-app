const fs = require('fs');
const path = require('path');

function fixEncoding(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            fixEncoding(fullPath);
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
            const buffer = fs.readFileSync(fullPath);
            let content;
            
            // Detect UTF-16LE BOM
            if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
                console.log(`Fixing UTF-16LE: ${fullPath}`);
                content = buffer.toString('utf16le');
            } else if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
                console.log(`Fixing UTF-16BE: ${fullPath}`);
                content = buffer.toString('utf16be');
            } else {
                // Assume it might be UTF-8 or already okay, but let's re-save to be sure
                // and remove any potential UTF-8 BOM
                content = buffer.toString('utf8');
                if (content.charCodeAt(0) === 0xFEFF) {
                    console.log(`Removing UTF-8 BOM: ${fullPath}`);
                    content = content.substring(1);
                }
            }
            
            if (content) {
                fs.writeFileSync(fullPath, content, { encoding: 'utf8', flag: 'w' });
            }
        }
    }
}

fixEncoding('./app');
fixEncoding('./src');
console.log('Project encoding fix complete!');
