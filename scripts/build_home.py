#!/usr/bin/env python3
"""Snapshot pinned GitHub projects and the two most recently edited paper notes."""
from pathlib import Path
from datetime import datetime, timezone
import json, os, re, subprocess, urllib.request
import yaml

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'assets/data/home.json'
QUERY = '{ user(login:"hstkwow") { pinnedItems(first:6, types:REPOSITORY) { nodes { ... on Repository { name description url stargazerCount primaryLanguage { name } } } } } }'
DESCRIPTIONS = {
    'hstkwow.github.io': 'My personal website, projects, and research reading notes.',
    'Tinyrenderer': 'A software rasterizer exploring the fundamentals of computer graphics.',
}

def projects():
    token = os.environ.get('GH_TOKEN')
    try:
        if not token:
            raise RuntimeError('GH_TOKEN is not configured')
        request = urllib.request.Request('https://api.github.com/graphql', data=json.dumps({'query': QUERY}).encode(), headers={'Authorization': 'Bearer '+token, 'Content-Type': 'application/json', 'User-Agent': 'hstkwow-home-build'})
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.load(response)
        if payload.get('errors'):
            raise RuntimeError(payload['errors'])
        pinned = payload['data']['user']['pinnedItems']['nodes']
        return [dict(name=p['name'], url=p['url'], description=p['description'] or DESCRIPTIONS.get(p['name'], 'Source code and project details on GitHub.'), stars=p['stargazerCount'], language=(p['primaryLanguage'] or {}).get('name', '')) for p in sorted(pinned, key=lambda p: -p['stargazerCount'])[:2]]
    except Exception as error:
        if not OUTPUT.exists():
            raise
        print(f'GitHub sync unavailable; keeping last successful project snapshot: {error}')
        return json.loads(OUTPUT.read_text())['projects']

def reading():
    notes = []
    for path in (ROOT/'notes').glob('*/index.md'):
        source = path.read_text(encoding='utf-8')
        match = re.match(r'\A---\n(.*?)\n---(?:\n|$)', source, re.S)
        meta = yaml.safe_load(match[1]) if match else {}
        body = source[match.end():] if match else source
        stamp = subprocess.run(['git','log','-1','--format=%cI','--',str(path.relative_to(ROOT))], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
        if not stamp:
            stamp = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat()
        summary = meta.get('summary')
        if not summary:
            body = re.sub(r'```[\s\S]*?```|!\[[^\]]*\]\([^)]*\)|\$\$[\s\S]*?\$\$', '', body)
            paragraphs = [p.strip() for p in body.split('\n\n') if p.strip() and not p.lstrip().startswith(('#','!','|','>'))]
            summary = re.sub(r'\[([^\]]+)\]\([^)]*\)', r'\1', paragraphs[0] if paragraphs else '')
            summary = re.sub(r'(?m)^\s*[-+*]\s+', '', summary)
            summary = re.sub(r'[*`_]|\n', ' ', summary)
            summary = re.sub(r'\s+', ' ', summary).strip()
        summary = str(summary)
        if len(summary)>160:
            summary = summary[:157].rstrip()+'…'
        notes.append(dict(id=path.parent.name,title=str(meta.get('title') or path.parent.name),topic=str(meta.get('topic') or 'Pansharpening'),summary=summary,updated_at=stamp))
    return sorted(notes, key=lambda n: (-datetime.fromisoformat(n['updated_at']).timestamp(),n['id']))[:2]

if __name__ == '__main__':
    data = dict(projects=projects(), reading=reading())
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print('Built homepage previews: 2 pinned projects and 2 recently updated notes.')
