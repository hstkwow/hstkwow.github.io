# HSTK personal website

Three static page entry points; shared assets are kept under `assets/`.

```text
index.html                Home
projects.html             Projects
papers.html               Reading collection and note viewer
assets/
  css/base.css            Shared theme, navigation and document columns
  css/home.css            Homepage layout
  css/reading.css         Markdown and reading collection layout
  js/site.js              Theme, shared helpers and contextual navigation
  js/projects.js          Project browsing
  js/reading.js           Reading collection, note routing, images and math
  data/projects.js        Editable project content
  data/reading-index.js   Generated from notes; do not edit
  vendor/                 Bundled MathJax and license
notes/                    Edit paper Markdown and screenshots here
scripts/                  Note build and local preview
config/                   Reading guide and Python dependency list
templates/paper.md       New paper template
.github/workflows/        Automatic Pages build and deployment
```

See [READING.md](config/READING.md) for adding notes, previewing and enabling GitHub Pages. No framework or Node build is required. Edit project content in `assets/data/projects.js`; edit paper content in `notes/`.
