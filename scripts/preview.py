#!/usr/bin/env python3
"""Preview and rebuild the reading index automatically when Markdown or images change."""
from pathlib import Path
import http.server,threading,time,subprocess,sys,functools
ROOT=Path(__file__).resolve().parents[1]
def state():return tuple(sorted((str(p),p.stat().st_mtime_ns) for p in (ROOT/'notes').rglob('*') if p.is_file()))
def rebuild():return subprocess.run([sys.executable,str(ROOT/'scripts/build_notes.py')]).returncode==0
if not rebuild():sys.exit(1)
def watch():
 old=state()
 while True:
  time.sleep(1);new=state()
  if new!=old:
   old=new;rebuild()
threading.Thread(target=watch,daemon=True).start()
server=http.server.ThreadingHTTPServer(('127.0.0.1',8000),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(ROOT)))
print('Preview: http://localhost:8000/papers.html — notes are rebuilt automatically; refresh after editing.',flush=True)
try:server.serve_forever()
except KeyboardInterrupt:server.server_close()
