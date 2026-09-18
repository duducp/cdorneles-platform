/**
 * Shared PostCSS configuration for Mantine. Referenced by each app's
 * `postcss.config.cjs` so the plugin list lives in one place.
 */
export const mantinePostcssPlugins = {
  "postcss-preset-mantine": {},
  "postcss-simple-vars": {
    variables: {
      "mantine-breakpoint-xs": "36em",
      "mantine-breakpoint-sm": "48em",
      "mantine-breakpoint-md": "62em",
      "mantine-breakpoint-lg": "75em",
      "mantine-breakpoint-xl": "88em",
    },
  },
};
