const doorstep = require('../../design/tailwind-theme.cjs');

module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: doorstep.darkMode,
  theme: { ...doorstep.overrides, extend: doorstep.extend },
};
