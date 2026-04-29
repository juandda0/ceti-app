const fs = require('fs');
const files = [
  'app/(child)/goals.tsx',
  'app/(child)/wallet.tsx',
  'app/(child)/profile.tsx',
  'app/(child)/learn.tsx',
  'app/(child)/world.tsx'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = '';
    if (file.includes('goals.tsx')) {
        content = "import GoalsScreen from '@features/savings/screens/GoalsScreen';\nexport default GoalsScreen;\n";
    } else if (file.includes('wallet.tsx')) {
        content = "import WalletScreen from '@features/savings/screens/WalletScreen';\nexport default WalletScreen;\n";
    } else if (file.includes('profile.tsx')) {
        content = "import ProfileScreen from '@features/child/screens/ProfileScreen';\nexport default ProfileScreen;\n";
    } else if (file.includes('learn.tsx')) {
        content = "import LearnScreen from '@features/education/screens/LearnScreen';\nexport default LearnScreen;\n";
    } else if (file.includes('world.tsx')) {
        content = "import WorldScreen from '@features/world/screens/WorldScreen';\nexport default WorldScreen;\n";
    }
    
    if (content) {
        fs.writeFileSync(file, content, { encoding: 'utf8', flag: 'w' });
        console.log(`Fixed ${file}`);
    }
  }
});
