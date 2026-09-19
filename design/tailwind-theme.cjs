/**
 * Doorstep theme extension. Spread into the app's tailwind.config once the Vite app exists:
 *
 *   const doorstep = require('../design/tailwind-theme.cjs');
 *   module.exports = { content: [...], darkMode: doorstep.darkMode, theme: { extend: doorstep.extend } };
 *
 * Every value points at a CSS variable from design/tokens.css, so dark mode is a class
 * toggle on <html> and never a second set of Tailwind classes.
 */

const v = (name) => `var(--${name})`;

module.exports = {
  darkMode: 'class',

  extend: {
    colors: {
      background: v('color-background'),
      surface: {
        DEFAULT: v('color-surface'),
        raised: v('color-surface-raised'),
        sunken: v('color-surface-sunken'),
      },
      foreground: {
        DEFAULT: v('color-foreground'),
        muted: v('color-foreground-muted'),
        inverse: v('color-foreground-inverse'),
      },
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
      },
      ring: v('color-ring'),
      overlay: v('color-overlay'),

      success: {
        DEFAULT: v('color-success'),
        subtle: v('color-success-subtle'),
        border: v('color-success-border'),
      },
      danger: {
        DEFAULT: v('color-danger'),
        subtle: v('color-danger-subtle'),
        border: v('color-danger-border'),
        accent: v('color-danger-accent'),
      },
      warning: {
        DEFAULT: v('color-warning'),
        subtle: v('color-warning-subtle'),
        border: v('color-warning-border'),
      },
      neutral: {
        DEFAULT: v('color-neutral'),
        subtle: v('color-neutral-subtle'),
        border: v('color-neutral-border'),
      },

      // Domain pills. Named for the merchant-facing stage, not the colour.
      pill: {
        'shipped-bg': v('pill-shipped-bg'),
        'shipped-fg': v('pill-shipped-fg'),
        'shipped-border': v('pill-shipped-border'),
        'waiting-bg': v('pill-waiting-bg'),
        'waiting-fg': v('pill-waiting-fg'),
        'waiting-border': v('pill-waiting-border'),
        'attention-bg': v('pill-attention-bg'),
        'attention-fg': v('pill-attention-fg'),
        'attention-border': v('pill-attention-border'),
        'skipped-bg': v('pill-skipped-bg'),
        'skipped-fg': v('pill-skipped-fg'),
        'skipped-border': v('pill-skipped-border'),
        'paused-bg': v('pill-paused-bg'),
        'paused-fg': v('pill-paused-fg'),
        'paused-border': v('pill-paused-border'),
      },
      banner: {
        fg: v('banner-fg'),
        'danger-bg': v('banner-danger-bg'),
        'danger-border': v('banner-danger-border'),
        'danger-accent': v('banner-danger-accent'),
        'danger-icon': v('banner-danger-icon'),
        'warning-bg': v('banner-warning-bg'),
        'warning-border': v('banner-warning-border'),
        'warning-accent': v('banner-warning-accent'),
        'warning-icon': v('banner-warning-icon'),
        'info-bg': v('banner-info-bg'),
        'info-border': v('banner-info-border'),
        'info-accent': v('banner-info-accent'),
        'info-icon': v('banner-info-icon'),
      },
      card: {
        bg: v('card-bg'),
        border: v('card-border'),
      },
      row: {
        border: v('event-row-border'),
        hover: v('event-row-hover-bg'),
        'failed-bg': v('event-row-failed-bg'),
        'failed-accent': v('event-row-failed-accent'),
        'header-fg': v('event-row-header-fg'),
      },
      drawer: v('drawer-bg'),
    },

    fontFamily: {
      sans: [v('primitive-fontFamily-sans')],
      mono: [v('primitive-fontFamily-mono')],
    },

    borderRadius: {
      sm: v('primitive-radius-sm'),
      md: v('primitive-radius-md'),
      lg: v('primitive-radius-lg'),
      xl: v('primitive-radius-xl'),
    },

    boxShadow: {
      sm: v('primitive-shadow-sm'),
      md: v('primitive-shadow-md'),
      lg: v('primitive-shadow-lg'),
    },

    spacing: {
      gutter: v('spacing-gutter'),
      stack: v('spacing-stack'),
      section: v('spacing-section'),
      touch: v('primitive-size-touch-target'),
    },

    minHeight: {
      touch: v('primitive-size-touch-target'),
      row: v('event-row-min-height'),
    },

    minWidth: {
      touch: v('primitive-size-touch-target'),
    },

    width: {
      rail: v('primitive-size-rail'),
      drawer: v('primitive-size-drawer'),
    },

    height: {
      control: v('primitive-size-control-md'),
      tabbar: v('primitive-size-tabbar'),
    },

    maxWidth: {
      content: v('primitive-size-content-max'),
    },

    transitionDuration: {
      fast: v('primitive-duration-fast'),
      normal: v('primitive-duration-normal'),
      slow: v('primitive-duration-slow'),
    },

    outlineWidth: {
      focus: v('focus-width'),
    },

    outlineColor: {
      focus: v('focus-color'),
    },
  },
};
