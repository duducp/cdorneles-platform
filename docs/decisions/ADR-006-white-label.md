# ADR-006: White-label Model

## Status

Accepted

## Decision

Organizations can customize:

- display name;
- light logo;
- dark logo;
- favicon;
- primary color;
- secondary color;
- default theme.

No custom fonts initially.

Only Light and Dark themes are exposed.

The organization default can be overridden by the user.

## Consequences

Organizations can have their own visual identity without allowing arbitrary customization that would undermine accessibility or platform consistency.

## Note: default theme vs. system preference

The organization `defaultTheme` applies unless the user has chosen a theme. On a
first visit with no stored choice, the apps follow the browser/OS preference
(`prefers-color-scheme`) through `ThemeProvider`'s `respectSystemPreference`
(default `true`), which therefore takes precedence over `defaultTheme` on that
first visit. An app that must force the organization default can pass
`respectSystemPreference={false}`.
