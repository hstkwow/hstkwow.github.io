# HSTK personal website

Three static page entry points; shared assets are kept under `assets/`. There is no framework and
no Node build: pages load native ES modules, and only the reading notes are compiled (by Python).

```text
index.html                Home (with the live pansharpening figure)
projects.html             Projects
papers.html               Reading collection and note viewer
assets/
  css/base.css            Shared theme, navigation, command palette, document columns
  css/home.css            Homepage layout and FIG. 01
  css/reading.css         Markdown, collection, acquisition log, figure viewer
  js/core/                Shared modules: theme, masthead, ⌘K palette, data loading
  js/home/sensor.js       WebGL pansharpening demo (procedural scene, LRMS/PAN/fused, spectra)
  js/reading/             Reading app: routing, lazy MathJax, zoomable figures, timeline
  js/projects/main.js     Project browsing (?project=<id> links)
  data/projects.js        Editable project content (ES module)
  data/reading/           Generated from notes; git-ignored, rebuilt by CI
  vendor/                 Bundled MathJax and license
notes/                    Edit paper Markdown and screenshots here
scripts/                  Note build and local preview
config/                   Reading guide and Python dependency list
templates/paper.md        New paper template
.github/workflows/        Automatic Pages build and deployment
```

## How the reading page stays fast

- `data/reading/manifest.json` (a few KB) holds only metadata, so the collection renders at once.
- Each note body is a separate content-versioned JSON file, fetched when opened (or on hover).
- Full-text search data (`search.json`) loads on the first keystroke.
- MathJax (2 MB) is never on the critical path: it is prefetched when idle and executed only for
  notes that contain math.
- Screenshots are converted to resized WebP at build time; the viewer opens the original PNG.

See [READING.md](config/READING.md) for adding notes, previewing and enabling GitHub Pages. Edit
project content in `assets/data/projects.js`; edit paper content in `notes/`.

Because pages use ES modules and `fetch`, open the site through `scripts/preview.py` (or any
static server) rather than as `file://`.
