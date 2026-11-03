# HSTK · Personal Website

My homepage, projects, and reading notes on computer vision and pansharpening.

[Website](https://hstkwow.top/) · [Projects](https://hstkwow.top/projects.html) · [Reading](https://hstkwow.top/papers.html)

## Preview locally

Built with HTML, CSS, JavaScript, and Python. No Node.js build required.

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r config/requirements.txt
.venv/bin/python scripts/preview.py
```

Open [localhost:8000](http://localhost:8000/).

## Update content

- **Homepage:** `index.html`
- **Projects:** `assets/data/projects.js`
- **Notes:** `notes/<paper>/index.md`, with screenshots in `images/`

Push to `main` to build and deploy with GitHub Actions. Homepage previews refresh during deployment: two top-starred pinned projects and two recently updated notes.

See the [maintenance guide](config/READING.md) for note metadata, images, and publishing details.
