// Minifica los Lottie de assets/animations. Los exportadores (AE/Bodymovin, LottieFiles)
// sacan JSON con indentación y floats largos: minificar y redondear reduce ~70% sin
// cambio visible. Uso: npm run anim:optimize
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'assets/animations';
// 3 decimales bastan para coordenadas y curvas de easing; menos deforma trazados.
const round = (_key, value) => (typeof value === 'number' ? Math.round(value * 1000) / 1000 : value);

function* jsonFiles(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* jsonFiles(path);
    else if (name.endsWith('.json')) yield path;
  }
}

for (const file of jsonFiles(ROOT)) {
  const before = statSync(file).size;
  writeFileSync(file, JSON.stringify(JSON.parse(readFileSync(file, 'utf8')), round));
  const after = statSync(file).size;
  console.log(`${file}: ${(before / 1024).toFixed(0)} KB -> ${(after / 1024).toFixed(0)} KB`);
}
