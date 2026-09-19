const fs = require('fs');
const css = fs.readFileSync(process.argv[2], 'utf8');

// Split :root (light) from .dark (dark overrides layered on top of light)
const darkIdx = css.indexOf('.dark {');
const lightSrc = css.slice(0, darkIdx === -1 ? css.length : darkIdx);
const darkSrc = darkIdx === -1 ? '' : css.slice(darkIdx);

const parse = (src) => {
  const map = {};
  for (const m of src.matchAll(/(--[A-Za-z0-9-]+):\s*([^;]+);/g)) map[m[1]] = m[2].trim();
  return map;
};
const light = parse(lightSrc);
const dark = { ...light, ...parse(darkSrc) };

const lum = (hex) => {
  const h = hex.replace('#', '');
  const ch = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// [label, fgVar, bgVar, minimum]
const PAIRS = [
  ['pill shipped',            '--pill-shipped-fg',        '--pill-shipped-bg',        4.5],
  ['pill waiting',            '--pill-waiting-fg',        '--pill-waiting-bg',        4.5],
  ['pill attention',          '--pill-attention-fg',      '--pill-attention-bg',      4.5],
  ['pill skipped',            '--pill-skipped-fg',        '--pill-skipped-bg',        4.5],
  ['pill paused',             '--pill-paused-fg',         '--pill-paused-bg',         4.5],
  ['banner danger text',      '--banner-fg',              '--banner-danger-bg',       4.5],
  ['banner warning text',     '--banner-warning-icon',    '--banner-warning-bg',      4.5],
  ['banner info text',        '--banner-fg',              '--banner-info-bg',         4.5],
  ['body on background',      '--color-foreground',       '--color-background',       4.5],
  ['body on surface',         '--color-foreground',       '--color-surface',          4.5],
  ['muted on background',     '--color-foreground-muted', '--color-background',       4.5],
  ['muted on surface',        '--color-foreground-muted', '--color-surface',          4.5],
  ['link on surface',         '--color-primary-text',     '--color-surface',          4.5],
  ['primary button label',    '--button-primary-fg',      '--button-primary-bg',      4.5],
  ['secondary button label',  '--button-secondary-fg',    '--button-secondary-bg',    4.5],
  ['nav active',              '--nav-item-active-fg',     '--nav-item-active-bg',     4.5],
  ['nav rest on surface',     '--nav-item-fg',            '--color-surface',          4.5],
  ['stat value',              '--stat-value-fg',          '--color-surface',          4.5],
  ['stat label',              '--stat-label-fg',          '--color-surface',          4.5],
  ['table header',            '--event-row-header-fg',    '--color-surface',          4.5],
  ['body on failed row',      '--color-foreground',       '--event-row-failed-bg',    4.5],
  // Non-text UI: 3:1 is the bar
  ['control border',          '--color-border-strong',    '--color-background',       3.0],
  ['focus ring on surface',   '--focus-color',            '--color-surface',          3.0],
  ['focus ring on bg',        '--focus-color',            '--color-background',       3.0],
  ['failed row accent',       '--event-row-failed-accent','--event-row-failed-bg',    3.0],
];

let fails = 0;
for (const theme of [['light', light], ['dark', dark]]) {
  const [name, vars] = theme;
  console.log(`\n=== ${name} ===`);
  for (const [label, fgV, bgV, min] of PAIRS) {
    const fg = vars[fgV], bg = vars[bgV];
    if (!fg || !bg || !fg.startsWith('#') || !bg.startsWith('#')) {
      console.log(`  SKIP ${label} (${!fg ? fgV : bgV} not a hex)`);
      continue;
    }
    const r = ratio(fg, bg);
    const ok = r >= min;
    if (!ok) fails++;
    console.log(`  ${ok ? 'PASS' : 'FAIL'} ${label.padEnd(24)} ${r.toFixed(2)}:1 (min ${min})`);
  }
}
console.log(fails === 0 ? '\nAll pairs pass.' : `\n${fails} FAILING PAIR(S).`);
process.exit(fails === 0 ? 0 : 1);
