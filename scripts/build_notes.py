#!/usr/bin/env python3
"""Compile notes into a small manifest plus per-note JSON loaded on demand; no CDN needed at runtime."""
from pathlib import Path
from datetime import datetime
from urllib.parse import urlsplit, unquote, quote
from html.parser import HTMLParser
import argparse, hashlib, html, json, re, shutil
import yaml, markdown, bleach
try: from PIL import Image
except ImportError: Image = None


ROOT = Path(__file__).resolve().parents[1]
NOTES = ROOT / 'notes'
OUT = ROOT / 'assets/data/reading'
IMAGE_WIDTH = 1600

def optimise(source, produced):
    """Write a resized WebP copy of a screenshot; return (url, width, height) or None."""
    if Image is None or source.suffix.lower() not in ('.png', '.jpg', '.jpeg'): return None
    digest=hashlib.sha256(source.read_bytes()+str(IMAGE_WIDTH).encode()).hexdigest()[:16]
    target=OUT/'img'/(digest+'.webp');produced.add(target)
    if not target.exists():
        with Image.open(source) as im:
            im=im.convert('RGBA' if 'A' in im.getbands() else 'RGB')
            if im.width>IMAGE_WIDTH: im=im.resize((IMAGE_WIDTH,round(im.height*IMAGE_WIDTH/im.width)),Image.LANCZOS)
            target.parent.mkdir(parents=True,exist_ok=True);im.save(target,'WEBP',quality=84,method=6)
    with Image.open(target) as im: return target.relative_to(ROOT).as_posix(), im.width, im.height

def timestamp(value, field, path):
    if value in (None, ''): return None
    try:
        d = datetime.fromisoformat(str(value))
        if d.tzinfo is None: raise ValueError('include a timezone, e.g. +08:00')
        return d
    except ValueError as e: raise ValueError(f'{path}: invalid {field}: {e}')

class HTML(HTMLParser):
    def __init__(self): super().__init__(convert_charrefs=False); self.output=[]; self.ids=set()
    def handle_starttag(self, tag, attrs):
        attrs=dict(attrs)
        if 'id' in attrs: self.ids.add(attrs['id'])
        self.output.append('<'+tag+''.join(' '+k+'="'+html.escape(v or '',quote=True)+'"' for k,v in attrs.items())+'>')
    def handle_startendtag(self,t,a): self.handle_starttag(t,a)
    def handle_endtag(self,t): self.output.append('</'+t+'>')
    def handle_data(self,d): self.output.append(d)
    def handle_entityref(self,n): self.output.append('&'+n+';')
    def handle_charref(self,n): self.output.append('&#'+n+';')

class Rewriter(HTML):
    def __init__(self, path, catalog, produced): super().__init__(); self.path=path; self.catalog=catalog; self.produced=produced; self.links=[]
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if tag in ('img','a'):
            key='src' if tag=='img' else 'href';value=attrs.get(key,'');u=urlsplit(value)
            if u.scheme:
                if u.scheme not in ('http','https','mailto'): raise ValueError(f'{self.path}: unsupported link {value}')
                if tag=='a':attrs.update(target='_blank',rel='noopener noreferrer')
            elif u.path:
                target=(self.path.parent/unquote(u.path)).resolve()
                if not target.is_relative_to(NOTES.resolve()) or not target.is_file():raise ValueError(f'{self.path}: broken local link: {value}')
                if tag=='a' and target.suffix=='.md':
                    if target not in self.catalog:raise ValueError(f'{self.path}: linked note not included: {value}')
                    ident=self.catalog[target]['id'];attrs[key]='papers.html?note='+quote(ident,safe='')+ ('#'+quote(unquote(u.fragment),safe='') if u.fragment else '')
                    self.links.append((target,unquote(u.fragment)))
                else:
                    attrs[key]=quote(target.relative_to(ROOT).as_posix(),safe='/')+('#'+u.fragment if u.fragment else '')
                    small=optimise(target,self.produced) if tag=='img' else None
                    # The page shows a light WebP; the lightbox opens the original screenshot.
                    if small: attrs.update({'data-full':attrs[key],'src':small[0],'width':str(small[1]),'height':str(small[2])})
            elif u.fragment:self.links.append((self.path,unquote(u.fragment)))
            if tag=='img':attrs.update(loading='lazy',decoding='async')
        super().handle_starttag(tag,list(attrs.items()))

def build():
    catalog={}
    # A paper is notes/<slug>/index.md; auxiliary concept documents live in SmallNote/.
    paths=sorted(NOTES.glob('*/index.md'))+sorted((NOTES/'SmallNote').glob('*.md'))
    for path in paths:
        source=path.read_text(encoding='utf-8');meta={};body=source
        if source.startswith('---\n'):
            match=re.match(r'\A---\n(.*?)\n---(?:\n|$)',source,re.S)
            if not match:raise ValueError(f'{path}: unclosed YAML front matter')
            meta=yaml.safe_load(match[1]) or {};body=source[match.end():]
            if not isinstance(meta,dict):raise ValueError(f'{path}: YAML must be a mapping')
        kind='concept' if path.parent.name=='SmallNote' else 'paper'
        title=str(meta.get('title') or (re.search(r'^# (.+)$',body,re.M).group(1) if re.search(r'^# (.+)$',body,re.M) else (path.stem if kind=='concept' else path.parent.name)))
        if kind=='paper' and not meta.get('title'):raise ValueError(f'{path}: title is required')
        start=timestamp(meta.get('started_at'),'started_at',path);end=timestamp(meta.get('finished_at'),'finished_at',path)
        if end and not start:raise ValueError(f'{path}: finished_at requires started_at')
        if start and end and end<start:raise ValueError(f'{path}: finished_at precedes started_at')
        tags=meta.get('tags',[])
        if isinstance(tags,str):tags=[tags]
        if not isinstance(tags,list):raise ValueError(f'{path}: tags must be a list')
        ident='concepts/'+path.stem if kind=='concept' else path.parent.name
        paper_url=str(meta.get('paper_url') or '')
        if paper_url and urlsplit(paper_url).scheme not in ('http','https'):raise ValueError(f'{path}: invalid paper_url')
        catalog[path.resolve()]=dict(id=ident,kind=kind,title=title,topic=str(meta.get('topic') or ('Concepts' if kind=='concept' else 'Pansharpening')),tags=[str(t) for t in tags],started_at=start.isoformat() if start else None,finished_at=end.isoformat() if end else None,span_seconds=(end-start).total_seconds() if start and end else None,status='completed' if end else 'reading',paper_url=paper_url,publication_status=str(meta.get('publication_status') or ''),summary=str(meta.get('summary') or ''),source=path.relative_to(ROOT).as_posix(),_body=body)
    rewrites={};produced=set()
    for path,item in catalog.items():
        body=item.pop('_body');formulas=[]
        # Preserve code literally; protect TeX before Markdown interprets backslashes or underscores.
        pattern=r'(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]+`)|(\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$)'
        def protect(m):
            if m[1]:return m[1]
            token='MATHPLACEHOLDER'+str(len(formulas))+'END';formulas.append(m[2]);return token
        body=re.sub(pattern,protect,body)
        md=markdown.Markdown(extensions=['extra','toc','sane_lists','pymdownx.arithmatex'],extension_configs={'toc':{'permalink':False},'pymdownx.arithmatex':{'generic':True}})
        rendered=md.convert(body)
        for i,tex in enumerate(formulas):
            if tex.startswith('$$'):tex=r'\['+tex[2:-2]+r'\]'
            display=tex.startswith(r'\[')
            rendered=rendered.replace('MATHPLACEHOLDER'+str(i)+'END','<span class="arithmatex'+(' math-display' if display else '')+'">'+html.escape(tex)+'</span>')
        rendered=bleach.clean(rendered,tags=['a','p','br','hr','h1','h2','h3','h4','h5','h6','ul','ol','li','strong','em','blockquote','code','pre','img','table','thead','tbody','tr','th','td','del','span','div','sup','sub','dl','dt','dd'],attributes={'*':['id','class'],'a':['href','title'],'img':['src','alt','title'],'ol':['start'],'td':['align'],'th':['align']},protocols=['http','https','mailto'],strip=True)
        rewriter=Rewriter(path,catalog,produced);rewriter.feed(rendered);rewrites[path]=rewriter
        item['html']=''.join(rewriter.output)
        item['has_math']='class="arithmatex' in item['html']
        # Roughly 400 CJK characters or 220 English words per minute.
        text=re.sub('<[^>]+>',' ',rendered);cjk=len(re.findall(r'[\u3400-\u9fff]',text));words=len(re.findall(r'[A-Za-z0-9]+',text))
        item['minutes']=max(1,round(cjk/400+words/220))
        item['search_text']=re.sub('<[^>]+>',' ',rendered)
        item['status']=item['status'] if item['kind']=='paper' else 'reference'
    for path,rewrite in rewrites.items():
        for target,anchor in rewrite.links:
            if anchor and anchor not in rewrites[target].ids:raise ValueError(f'{path}: missing anchor {anchor} in {target}')
    items=sorted(catalog.values(),key=lambda p:(p['kind']!='paper',-(datetime.fromisoformat(p['finished_at'] or p['started_at']).timestamp() if p['finished_at'] or p['started_at'] else 0),p['id']))
    write_outputs(items,produced)
    print(f'Built {sum(p["kind"]=="paper" for p in items)} papers and {sum(p["kind"]=="concept" for p in items)} concept documents; links, timestamps and anchors validated.')
    return items

def write_outputs(items,produced):
    """manifest.json is tiny and drives the collection; note bodies and search text load on demand."""
    (OUT/'notes').mkdir(parents=True,exist_ok=True)
    manifest=[];search={}
    for item in items:
        body=json.dumps({'id':item['id'],'html':item.pop('html')},ensure_ascii=False,separators=(',',':'))
        name=hashlib.sha256(item['id'].encode()).hexdigest()[:12]+'.json'
        target=OUT/'notes'/name;produced.add(target)
        if not target.exists() or target.read_text(encoding='utf-8')!=body:target.write_text(body,encoding='utf-8')
        search[item['id']]=re.sub(r'\s+',' ',item.pop('search_text')).strip()
        manifest.append(dict(item,file='notes/'+name,v=hashlib.sha256(body.encode()).hexdigest()[:10]))
    for name,data in (('manifest.json',manifest),('search.json',search)):
        (OUT/name).write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8');produced.add(OUT/name)
    for stale in [p for p in OUT.rglob('*') if p.is_file() and p not in produced]:stale.unlink()

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path);args=parser.parse_args();build()
    if args.output:
        dest=args.output.resolve()
        if dest==ROOT or ROOT.is_relative_to(dest) or dest.is_relative_to(NOTES):raise ValueError('Output must be a separate directory')
        dest.mkdir(parents=True,exist_ok=True)
        for pattern in ['*.html']:
            for p in ROOT.glob(pattern):shutil.copy2(p,dest/p.name)
        for name in ['assets','notes']:shutil.copytree(ROOT/name,dest/name,dirs_exist_ok=True)
        (dest/'.nojekyll').touch()
