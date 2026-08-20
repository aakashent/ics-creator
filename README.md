# ICS Creator

A mobile-first static web app for turning selected dates from a Google Sheet (or a pasted list of dates) into an `.ics` calendar file.

## Features

- Paste a normal Google Sheets link and read the selected `gid` tab.
- Defaults to inspecting the **last 500 rows**, with 1,000 / 2,500 / all-row options.
- Choose the date column and optionally filter on any other column/value.
- No person or filter value is selected by default.
- Imported dates are placed into an editable dates box.
- Accepts `DD/MM/YYYY`, `DD/MM`, comma/newline-separated dates and ranges such as `21/08/2026-23/08/2026`.
- **Individual days** exports one all-day event per date.
- **Group consecutive** combines runs such as 21, 22 and 23 August into one 21–23 August event.
- Preview shows how many calendar events will be generated.
- Creates and downloads the `.ics` entirely in the browser.
- Responsive, touch-friendly interface with an iPhone-safe sticky download button.

## Google Sheet access

The sheet must be viewable without signing in (for example, **Anyone with the link – Viewer**). The app first tries Google's CSV output and has a Google Visualization JSONP fallback for browser/CORS compatibility.

Sheet data is processed in the browser and is not uploaded to this project.

## GitHub Pages

A Pages deployment workflow is included in `.github/workflows/pages.yml`. After merging to `main`, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions** if it is not already enabled.
