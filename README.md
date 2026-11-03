<div align="center">

# HSTK · Personal Website

**Projects, paper notes, and things I’m learning.**

A personal homepage and reading journal by Sun Tao — a graduate student at Tiangong University interested in computer vision.

[Visit the website](https://hstkwow.top/) · [Projects](https://hstkwow.top/projects.html) · [Reading journal](https://hstkwow.top/papers.html) · [Maintenance guide](config/READING.md)

[![Pages deployment](https://github.com/hstkwow/hstkwow.github.io/actions/workflows/pages.yml/badge.svg)](https://github.com/hstkwow/hstkwow.github.io/actions/workflows/pages.yml)

</div>

---

## Overview

A lightweight static website with an editorial layout: serif headings, open sections, and a warm paper palette in light and dark modes. The homepage introduces my background, education, and awards, followed by selected GitHub projects and recent reading notes.

The reading journal focuses on pansharpening and related computer vision methods. Notes live alongside their screenshots in this repository, so publishing a new entry takes a normal Git commit and push.

**Built with HTML, CSS, native JavaScript modules, and a small Python content pipeline.** No Node.js build or application server is required.

## Features

| Area | What it includes |
| --- | --- |
| Homepage | About, education, awards, two pinned GitHub projects, and two recently updated paper notes |
| Projects | Project descriptions, implementation details, and technology stacks |
| Reading journal | Markdown paper notes, independent concept notes, search, and an on-page contents list |
| Research content | Bundled MathJax, local screenshots, enlarged image viewing, and reading start/finish times |
| Appearance | Persistent light/dark themes, responsive layouts, and an interactive Earth illustration |
| Publishing | GitHub Actions builds and validates notes, then deploys to GitHub Pages |

## Quick start

Python 3.12 is used in deployment. Run these commands from the repository root:

```sh
git clone https://github.com/hstkwow/hstkwow.github.io.git
cd hstkwow.github.io
python3 -m venv .venv
.venv/bin/python -m pip install -r config/requirements.txt
.venv/bin/python scripts/preview.py
```

Open [localhost:8000](http://localhost:8000/). The preview rebuilds the reading data when files in `notes/` change; refresh the browser after saving. Serve the site over HTTP because its modules and data requests require it.

## Manage content

### Add a paper note

Create a stable, unique folder using the supplied template:

```sh
mkdir -p notes/MyPaper/images
cp templates/paper.md notes/MyPaper/index.md
```

Edit the front matter and write the note below it:

```yaml
---
title: "My Paper"
topic: "Pansharpening"
summary: "A short description for the collection and homepage preview."
paper_url: ""
started_at: "2026-11-03T09:00:00+08:00"
finished_at: null
tags: [image-fusion]
---
```

Store screenshots in the same paper folder and reference them with relative paths:

```markdown
![Method overview](images/framework.png)
```

Only `title` is required. Use quoted ISO timestamps with a timezone; leave `finished_at` empty or `null` until finished. The displayed span measures elapsed time, including breaks. Standalone knowledge notes belong in `notes/SmallNote/` and do not need links to paper notes.

See the [reading maintenance guide](config/READING.md) for equations, image viewing, metadata, and validation rules.

### Update the homepage and projects

| Content | Source |
| --- | --- |
| Introduction, education, awards, and contact links | `index.html` |
| Full project portfolio | `assets/data/projects.js` |
| Homepage project previews | Two highest-starred repositories among my GitHub pins; refreshed during deployment |
| Homepage reading previews | Two paper notes with the most recent Git commit dates; summaries use `summary` or an excerpt |
| Homepage layout | `assets/css/home.css` |
| Shared palette, navigation, and page styles | `assets/css/base.css` |

The homepage snapshot is stored in `assets/data/home.json`. Refresh it locally with:

```sh
.venv/bin/python scripts/build_home.py
```

Set `GH_TOKEN` to a GitHub token to refresh pinned projects. Without it, the script keeps the existing project snapshot and still refreshes reading previews. The local preview watcher rebuilds reading data only; rerun this command to update homepage previews.

## Build and deploy

Every push to `main` runs the [Pages workflow](.github/workflows/pages.yml):

1. Fetch the full Git history and install Python dependencies.
2. Refresh homepage previews using the workflow’s GitHub token.
3. Compile notes, validate timestamps and local links, and generate reading data.
4. Upload the static site and deploy it to GitHub Pages.

In **Settings → Pages → Build and deployment**, use **GitHub Actions** as the source.

To build locally:

```sh
.venv/bin/python scripts/build_home.py
.venv/bin/python scripts/build_notes.py --output _site
```

`_site/` is the deployment output. `assets/data/reading/` is generated and Git-ignored; maintain the Markdown sources instead. If note validation fails, the workflow stops and the previous deployment remains available. A failed GitHub project refresh keeps the last successful project snapshot.

## Repository structure

```text
.
├── index.html                 # Personal homepage
├── projects.html              # Project portfolio
├── papers.html                # Reading collection and note viewer
├── assets/
│   ├── css/                   # Shared and page-specific styles
│   ├── js/                    # Navigation, globe, projects, and reading modules
│   ├── data/                  # Project content and homepage snapshot
│   ├── images/                # Site images and transparent school crests
│   └── vendor/                # Bundled MathJax and its license
├── notes/                     # Paper notes, concept notes, and screenshots
├── templates/paper.md         # New paper template
├── scripts/                   # Content builds and local preview
├── config/                    # Python requirements and reading guide
└── .github/workflows/pages.yml
```

## How the reading journal loads

The collection first fetches a small metadata manifest. Each note body is loaded separately with a content version, and full-text search data loads when needed. MathJax renders equations in notes that contain math. Screenshots are resized into WebP copies during the build; the image viewer opens the original file.

## Design references

The editorial section structure draws inspiration from [Involution Hell](https://involutionhell.com/zh). This README’s organization references [Astro Theme Shyne](https://github.com/FuTseYi/Astro-Theme-Shyne). The website uses its own static implementation.
