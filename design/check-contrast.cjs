// WCAG contrast audit for design/tokens.css, in both themes.
// Usage: node design/check-contrast.cjs design/tokens.css
// Exits 1 if any pair falls below its floor. Also reports which text pairs reach the 7:1 target.
const fs = require('fs');
const css = fs.readFileSync(process.argv[2] || 'design/tokens.css', 'utf8');

const darkIdx = css.indexOf('.dark {');
const parse = (src) => {
  const map = {};
  for (const m of src.matchAll(/(--[A-Za-z0-9-]+):\s*([^;]+);/g)) map[m[1]] = m[2].trim();
  return map;
};
const light = parse(darkIdx === -1 ? css : css.slice(0, darkIdx));
const dark = { ...light, ...parse(darkIdx === -1 ? '' : css.slice(darkIdx)) };

const lum = (hex) => {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
};

const TEXT = 4.5, UI = 3.0, TARGET = 7.0;

// [label, fg, bg, floor]
const PAIRS = [
  ['body on background',      '--color-foreground',         '--color-background',        TEXT],
  ['body on surface',         '--color-foreground',         '--color-surface',           TEXT],
  ['muted on background',     '--color-foreground-muted',   '--color-background',        TEXT],
  ['muted on surface',        '--color-foreground-muted',   '--color-surface',           TEXT],
  ['link on surface',         '--color-primary-text',       '--color-surface',           TEXT],
  ['verdict ok',              '--verdict-ok-fg',            '--color-background',        TEXT],
  ['verdict issue',           '--verdict-issue-fg',         '--color-background',        TEXT],
  ['stat value',              '--stat-value-fg',            '--block-bg',                TEXT],
  ['stat label',              '--stat-label-fg',            '--block-bg',                TEXT],
  ['feature block text',      '--block-feature-fg',         '--block-feature-bg',        TEXT],
  ['primary button',          '--button-primary-fg',        '--button-primary-bg',       TEXT],
  ['primary button hover',    '--button-primary-fg',        '--button-primary-hover-bg', TEXT],
  ['secondary button',        '--button-secondary-fg',      '--button-secondary-bg',     TEXT],
  ['ghost button',            '--button-ghost-fg',          '--color-surface',           TEXT],
  ['nav active',              '--nav-item-active-fg',       '--nav-item-active-bg',      TEXT],
  ['nav rest',                '--nav-item-fg',              '--color-surface',           TEXT],
  ['pill shipped',            '--pill-shipped-fg',          '--pill-shipped-bg',         TEXT],
  ['pill waiting',            '--pill-waiting-fg',          '--pill-waiting-bg',         TEXT],
  ['pill attention',          '--pill-attention-fg',        '--pill-attention-bg',       TEXT],
  ['pill skipped',            '--pill-skipped-fg',          '--pill-skipped-bg',         TEXT],
  ['pill paused',             '--pill-paused-fg',           '--pill-paused-bg',          TEXT],
  ['banner danger text',      '--banner-fg',                '--banner-danger-bg',        TEXT],
  ['banner warning text',     '--banner-fg',                '--banner-warning-bg',       TEXT],
  ['banner info text',        '--banner-fg',                '--banner-info-bg',          TEXT],
  ['table header',            '--event-row-header-fg',      '--color-surface',           TEXT],
  ['body on failed row',      '--color-foreground',         '--event-row-failed-bg',     TEXT],
  // Non-text: glyphs in icon boxes, borders, markers, focus
  ['danger icon glyph',       '--banner-danger-icon-fg',    '--banner-danger-icon-bg',   UI],
  ['warning icon glyph',      '--banner-warning-icon-fg',   '--banner-warning-icon-bg',  UI],
  ['info icon glyph',         '--banner-info-icon-fg',      '--banner-info-icon-bg',     UI],
  ['control border',          '--color-border-strong',      '--color-background',        UI],
  ['block border',            '--color-border-block',       '--color-background',        UI],
  ['focus on surface',        '--focus-color',              '--color-surface',           UI],
  ['focus on background',     '--focus-color',              '--color-background',        UI],
  ['failed row accent',       '--event-row-failed-accent',  '--event-row-failed-bg',     UI],
  ['shipped dot',             '--pill-shipped-solid',       '--color-surface',           UI],
  ['attention dot',           '--pill-attention-solid',     '--color-surface',           UI],
  ['paused dot',              '--pill-paused-solid',        '--color-surface',           UI],
  ['waiting dot',             '--pill-waiting-solid',       '--color-surface',           UI],
  ['skipped dot',             '--pill-skipped-solid',       '--color-surface',           UI],
  ['danger banner edge',      '--banner-danger-border',     '--color-background',        UI],
  ['warning banner edge',     '--banner-warning-border',    '--color-background',        UI],
  ['info banner edge',        '--banner-info-border',       '--color-background',        UI],
];

let fails = 0;
for (const [name, vars] of [['light', light], ['dark', dark]]) {
  let atTarget = 0, textCount = 0;
  console.log(`\n=== ${name} ===`);
  for (const [label, fgV, bgV, floor] of PAIRS) {
    const fg = vars[fgV], bg = vars[bgV];
    if (!fg || !bg) { console.log(`  MISSING ${label}: ${!fg ? fgV : bgV}`); fails++; continue; }
    if (!fg.startsWith('#') || !bg.startsWith('#')) { console.log(`  SKIP ${label} (non-hex)`); continue; }
    const r = ratio(fg, bg);
    const ok = r >= floor;
    if (!ok) fails++;
    let tag = '';
    if (floor === TEXT) { textCount++; if (r >= TARGET) { atTarget++; tag = '  7:1 ✓'; } }
    console.log(`  ${ok ? 'PASS' : 'FAIL'} ${label.padEnd(22)} ${r.toFixed(2).padStart(5)}:1  (floor ${floor})${tag}`);
  }
  console.log(`  -> ${atTarget}/${textCount} text pairs reach the 7:1 target`);
}
console.log(fails === 0 ? '\nAll pairs pass their floor.' : `\n${fails} FAILING PAIR(S).`);
process.exit(fails === 0 ? 0 : 1);
