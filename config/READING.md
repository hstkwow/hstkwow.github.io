# Maintaining the reading journal

`notes/` in this website repository is the source of truth. The original research directory is a separate copy and does not synchronize automatically.

## Add or update a note

1. Create `notes/<paper-slug>/index.md`. Start from `templates/paper.md`; use a unique folder name and keep it stable so shared links continue to work.
2. Put screenshots in `notes/<paper-slug>/images/`. Link them as `![Caption](images/framework.png)`.
3. Fill in YAML fields and write Markdown headings, lists, tables and math. Existing Chinese notes are preserved; website controls remain English.
4. Preview locally, then commit and push the note and its images to `main`.

Required paper metadata: `title`. Optional fields: `topic`, `tags` (list), `summary`, `paper_url`, `started_at`, `finished_at`, and `publication_status`.

Use quoted ISO timestamps with a timezone, e.g. `"2026-10-17T14:00:00+08:00"`. Leave `finished_at: null` until finished. The displayed reading span is elapsed time including breaks, not active study time. Dates are displayed in UTC+08:00. All timestamps and local links are validated during the build.

Math supports `\( ... \)`, `\[ ... \]`, `$ ... $` and `$$ ... $$`. MathJax is bundled locally; the page does not require a math CDN. Click a screenshot, or focus it and press Enter, to enlarge it; use Escape or Close to dismiss.

## Independent concept notes

Keep standalone knowledge notes in `notes/SmallNote/*.md`. They appear under Concepts and are discovered automatically. Organize them with headings and read them independently; no links to or from paper notes are required. Paper notes remain focused on research tasks, architecture and modules.

## Local preview

Run from the repository root. One-time setup:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r config/requirements.txt
```

Then:

```sh
.venv/bin/python scripts/preview.py
```

Open `http://localhost:8000/papers.html`. The preview watches `notes/`; after saving a note or adding a new folder, wait about a second and refresh. The site must be served over HTTP (it uses ES modules and `fetch`); opening `papers.html` as a local file will not work.

For a one-off rebuild:

```sh
.venv/bin/python scripts/build_notes.py
```

`assets/data/reading/` (manifest, per-note JSON, search index and WebP copies of screenshots) is generated and git-ignored; do not edit it manually. Pillow is required for the WebP conversion. Invalid YAML, negative time spans, missing images or broken note links fail the build instead of silently publishing a broken note.

## GitHub Pages: one-time setup

The supplied `.github/workflows/pages.yml` builds notes and publishes the site on each push to `main`. Before relying on automatic publication, set the repository's **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. This change has not been made automatically.

Once enabled, adding a note requires only the Markdown, its images, and a normal commit/push. The workflow rebuilds the index, so you do not need to update a list or commit generated files for online publication. If a build fails, the existing deployment stays live; inspect the Actions log. Source files and imported screenshots are public when the repository and site are public.
