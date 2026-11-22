/**
 * Colour codes needed outside CSS. Each one mirrors a --palette-* value in src/theme/colors.css;
 * change both together.
 * - BROWSER_THEME_COLOR: browser toolbar colour (meta theme-color) = --palette-logo-blue
 * - FALLBACK_PAGE: the plain error page shown when the app itself cannot load (it has no access to the CSS)
 */
export const BROWSER_THEME_COLOR = "#004fac";

export const FALLBACK_PAGE = {
  logoBlue: "#004fac", // --palette-logo-blue
  ink: "#13233a", // --palette-ink
  slate: "#5d6d82", // --palette-slate
  mist: "#f2f6fa", // --palette-mist
  line: "#dbe4ee", // --palette-line
  white: "#ffffff", // --palette-white
} as const;
