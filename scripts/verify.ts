import { buildLevel, isBlocked } from '../src/game/logic';
let bad = 0;
for (let lvl = 1; lvl <= 40; lvl++) {
  const L = buildLevel(lvl);
  const total = L.arrows.length;
  const avg = L.arrows.reduce((s, a) => s + a.cells.length, 0) / total;
  const freeAtStart = L.arrows.filter((a) => !isBlocked(L, a)).length;
  let removed = 0, progress = true, rounds = 0;
  while (progress) {
    progress = false;
    const batch = L.arrows.filter((a) => !a.out && !isBlocked(L, a));
    batch.forEach((a) => { a.out = true; removed++; progress = true; });
    if (batch.length) rounds++;
  }
  const ok = removed === total;
  if (!ok) bad++;
  if (lvl <= 6 || lvl % 10 === 0 || !ok)
    console.log(`L${String(lvl).padStart(2)} ${L.cols}x${L.rows} arrows=${total} avgLen=${avg.toFixed(1)} freeAtStart=${freeAtStart} depth=${rounds} solvable=${ok}`);
}
if (bad) { console.error(`${bad} unsolvable levels`); process.exit(1); }
console.log('All levels solvable');
