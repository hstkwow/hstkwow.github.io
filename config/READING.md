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

## Concepts and links

Keep public concept references in `notes/SmallNote/*.md`. They are discovered automatically. Preserve existing explicit anchors such as `<a id="wald协议"></a>`.

From a paper, use `../SmallNote/知识点汇总.md#wald协议`. From the concept file, use `../UPPAN/index.md`. The builder converts links to website note URLs and checks targets and anchors. The old combined `back/Article.md` is not published or counted.

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

Open `http://localhost:8000/papers.html`. The preview watches `notes/`; after saving a note or adding a new folder, wait about a second and refresh. Existing generated content can also be opened directly from `papers.html`, but newly edited Markdown requires a rebuild first.

For a one-off rebuild:

```sh
.venv/bin/python scripts/build_notes.py
```

`assets/data/reading-index.js` is generated; do not edit it manually. Invalid YAML, negative time spans, missing images or broken note links fail the build instead of silently publishing a broken note.

## GitHub Pages: one-time setup

The supplied `.github/workflows/pages.yml` builds notes and publishes the site on each push to `main`. Before relying on automatic publication, set the repository's **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. This change has not been made automatically.

Once enabled, adding a note requires only the Markdown, its images, and a normal commit/push. The workflow rebuilds the index, so you do not need to update a list or commit the generated index for online publication. If a build fails, the existing deployment stays live; inspect the Actions log. Source files and imported screenshots are public when the repository and site are public.
