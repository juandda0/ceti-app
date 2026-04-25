const fs = require('fs');
const path = require('path');

const replacements = [
  { from: /@\/store\/useThemeStore/g, to: '@shared/store/useThemeStore' },
  { from: /@\/store\/useChildStore/g, to: '@features/auth/store/useChildStore' },
  { from: /@\/store\/useParentStore/g, to: '@features/family/store/useParentStore' },
  { from: /@\/store\/useSavingsStore/g, to: '@features/savings/store/useSavingsStore' },
  { from: /@\/store\/useWalletStore/g, to: '@features/savings/store/useWalletStore' },
  { from: /@\/store\/useLessonsStore/g, to: '@features/learning/store/useLessonsStore' },
  { from: /@\/store\/useWorldStore/g, to: '@features/world/store/useWorldStore' },
  { from: /@\/components\/common\//g, to: '@shared/components/' },
  { from: /@\/components\/world\//g, to: '@features/world/components/' },
  { from: /@\/hooks\//g, to: '@shared/hooks/' },
  { from: /@\/constants\//g, to: '@shared/constants/' },
  { from: /@\/data\/lessons/g, to: '@features/learning/data/lessons' },
  { from: /@\/data\/levels/g, to: '@shared/data/levels' },
  { from: /@\/data\/mockSession/g, to: '@shared/data/mockSession' },
];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      for (const r of replacements) {
        if (r.from.test(content)) {
          content = content.replace(r.from, r.to);
          changed = true;
        }
      }
      if (changed) {
        console.log(`Updating imports in ${fullPath}`);
        fs.writeFileSync(fullPath, content);
      }
    }
  }
}

walk('./src');
walk('./app');
console.log('Refactor complete!');
