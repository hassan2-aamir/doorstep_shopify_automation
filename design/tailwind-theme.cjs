/**
 * Doorstep theme. Wire into the app's tailwind.config once the Vite app exists:
 *
 *   const doorstep = require('../design/tailwind-theme.cjs');
 *   module.exports = {
 *     content: ['./index.html', './src/**\/*.{js,jsx,ts,tsx}'],
 *     darkMode: doorstep.darkMode,
 *     theme: { ...doorstep.overrides, extend: doorstep.extend },
 *   };
 *
 * `overrides` REPLACES Tailwind's shadow scales rather than extending them, so flat design is
 * enforced by the tooling: `shadow-md` and `drop-shadow-lg` stop existing. Separate surfaces
 * with colour blocks and borders instead.
 */

const v = (name) => `var(--${name})`;

module.exports = {
  darkMode: 'class',

  overrides: {
    boxShadow: { none: 'none' },
    dropShadow: { none: 'none' },
  },

  extend: {
    colors: {
      background: v('color-background'),
      surface: {
        DEFAULT: v('color-surface'),
        sunken: v('color-surface-sunken'),
      },
      foreground: {
        DEFAULT: v('color-foreground'),
        muted: v('color-foreground-muted'),
        inverse: v('color-foreground-inverse'),
      },
      brand: v('color-brand'),
      primary: {
        DEFAULT: v('color-primary'),
        hover: v('color-primary-hover'),
        active: v('color-primary-active'),
        foreground: v('color-primary-foreground'),
        text: v('color-primary-text'),
        subtle: v('color-primary-subtle'),
      },
      border: {
        DEFAULT: v('color-border'),
        strong: v('color-border-strong'),
        block: v('color-border-block'),
      },
      ring: v('color-ring'),
      overlay: v('color-overlay'),

      success: { DEFAULT: v('color-success'), solid: v('color-success-solid'), subtle: v('color-success-subtle'), border: v('color-success-border') },
      danger:  { DEFAULT: v('color-danger'),  solid: v('color-danger-solid'),  subtle: v('color-danger-subtle'),  border: v('color-danger-border') },
      warning: { DEFAULT: v('color-warning'), solid: v('color-warning-solid'), subtle: v('color-warning-subtle'), border: v('color-warning-border') },
      neutral: { DEFAULT: v('color-neutral'), solid: v('color-neutral-solid'), subtle: v('color-neutral-subtle'), border: v('color-neutral-border') },

      // Named for the merchant-facing stage, never the hue, so a palette swap never renames a class.
      shipped:   { bg: v('pill-shipped-bg'),   fg: v('pill-shipped-fg'),   border: v('pill-shipped-border'),   solid: v('pill-shipped-solid') },
      waiting:   { bg: v('pill-waiting-bg'),   fg: v('pill-waiting-fg'),   border: v('pill-waiting-border'),   solid: v('pill-waiting-solid') },
      attention: { bg: v('pill-attention-bg'), fg: v('pill-attention-fg'), border: v('pill-attention-border'), solid: v('pill-attention-solid') },
      skipped:   { bg: v('pill-skipped-bg'),   fg: v('pill-skipped-fg'),   border: v('pill-skipped-border'),   solid: v('pill-skipped-solid') },
      paused:    { bg: v('pill-paused-bg'),    fg: v('pill-paused-fg'),    border: v('pill-paused-border'),    solid: v('pill-paused-solid') },

      block: {
        DEFAULT: v('block-bg'),
        border: v('block-border'),
        'feature-bg': v('block-feature-bg'),
        'feature-fg': v('block-feature-fg'),
        'feature-border': v('block-feature-border'),
        'feature-accent': v('block-feature-accent'),
      },
      banner: {
        fg: v('banner-fg'),
        'danger-bg': v('banner-danger-bg'),   'danger-border': v('banner-danger-border'),   'danger-icon-bg': v('banner-danger-icon-bg'),   'danger-icon-fg': v('banner-danger-icon-fg'),
        'warning-bg': v('banner-warning-bg'), 'warning-border': v('banner-warning-border'), 'warning-icon-bg': v('banner-warning-icon-bg'), 'warning-icon-fg': v('banner-warning-icon-fg'),
        'info-bg': v('banner-info-bg'),       'info-border': v('banner-info-border'),       'info-icon-bg': v('banner-info-icon-bg'),       'info-icon-fg': v('banner-info-icon-fg'),
      },
      row: {
        border: v('event-row-border'),
        hover: v('event-row-hover-bg'),
        'failed-bg': v('event-row-failed-bg'),
        'failed-accent': v('event-row-failed-accent'),
        'header-fg': v('event-row-header-fg'),
      },
      verdict: { ok: v('verdict-ok-fg'), issue: v('verdict-issue-fg') },
      stat: { label: v('stat-label-fg'), value: v('stat-value-fg') },
      drawer: { DEFAULT: v('drawer-bg'), border: v('drawer-border') },
      skeleton: { DEFAULT: v('skeleton-bg'), sheen: v('skeleton-sheen') },
    },

    fontFamily: {
      sans: [v('primitive-fontFamily-sans')],
      mono: [v('primitive-fontFamily-mono')],
    },

    fontSize: {
      verdict: [v('verdict-size'), { lineHeight: v('verdict-line-height'), letterSpacing: v('verdict-tracking'), fontWeight: v('verdict-weight') }],
      stat: [v('stat-value-size'), { lineHeight: v('primitive-lineHeight-flat'), letterSpacing: v('stat-value-tracking'), fontWeight: v('stat-value-weight') }],
    },

    letterSpacing: {
      display: v('primitive-letterSpacing-display'),
      heading: v('primitive-letterSpacing-heading'),
      label: v('primitive-letterSpacing-label'),
    },

    borderRadius: {
      sm: v('primitive-radius-sm'),
      md: v('primitive-radius-md'),
      lg: v('primitive-radius-lg'),
      pill: v('primitive-radius-pill'),
    },

    borderWidth: {
      hairline: v('primitive-borderWidth-hairline'),
      thick: v('primitive-borderWidth-thick'),
      block: v('primitive-borderWidth-block'),
    },

    spacing: {
      gutter: v('spacing-gutter'),
      block: v('spacing-block'),
      'block-tight': v('spacing-block-tight'),
      section: v('spacing-section'),
      touch: v('primitive-size-touch-target'),
      'icon-block': v('primitive-size-icon-block'),
    },

    gap: {
      block: v('block-gap'),
      'block-tight': v('block-gap-tight'),
    },

    minHeight: { touch: v('primitive-size-touch-target'), row: v('event-row-min-height') },
    minWidth: { touch: v('primitive-size-touch-target') },
    width: { rail: v('primitive-size-rail'), drawer: v('primitive-size-drawer') },
    height: { control: v('primitive-size-control'), tabbar: v('primitive-size-tabbar') },
    maxWidth: { content: v('primitive-size-content-max') },

    transitionDuration: {
      press: v('primitive-duration-press'),
      fast: v('primitive-duration-fast'),
      base: v('primitive-duration-base'),
      slow: v('primitive-duration-slow'),
    },
    transitionTimingFunction: {
      'out-1': v('primitive-easing-out-1'),
      'out-2': v('primitive-easing-out-2'),
      'in-out': v('primitive-easing-in-out'),
    },
    scale: { press: v('primitive-scale-press') },

    outlineWidth: { focus: v('focus-width') },
    outlineOffset: { focus: v('focus-offset') },
    outlineColor: { focus: v('focus-color') },

    keyframes: {
      sheen: {
        '0%': { backgroundPosition: '-200% 0' },
        '100%': { backgroundPosition: '200% 0' },
      },
      'pop-in': {
        '0%': { opacity: '0', transform: 'translateY(4px)' },
        '100%': { opacity: '1', transform: 'translateY(0)' },
      },
    },
    animation: {
      sheen: `sheen ${v('skeleton-duration')} ${v('primitive-easing-in-out')} infinite`,
      'pop-in': `pop-in ${v('primitive-duration-slow')} ${v('primitive-easing-out-2')} both`,
    },
  },
};
