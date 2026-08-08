# Build sources for the v2 site

GitHub Pages does not serve underscore folders, so these are stored, not published.

- `page.html` — the landing page template (placeholders: fonts, orb, DOC_FLIGHT/DOC_DAY)
- `home.html` — the phone's day-home (real app DayV4 + TalonTabBar ported to HTML)
- `build-site.mjs` — builds the deployable site from these + the ui-lab prototypes
  (run from the app repo workspace; resolves `sharp` + fonts from the app's node_modules,
  images from `frontend/assets/images`, prototypes from `ui-lab/prototypes`)
- `build.mjs` — older single-file artifact build (kept for reference)
