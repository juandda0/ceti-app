const fs = require('fs');
const content = `import ParentDashboardScreen from '@features/family/screens/ParentDashboardScreen';
export default ParentDashboardScreen;
`;
fs.writeFileSync('app/(parent)/dashboard.tsx', content, { encoding: 'utf8', flag: 'w' });
console.log('File fixed successfully');
