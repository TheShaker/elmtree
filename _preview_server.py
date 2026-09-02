#!/usr/bin/env python3
import http.server, os, json
ROOT = os.path.dirname(os.path.abspath(__file__)); PORT = 8931
LEAVES = {"leaves": [
  {"id":"shaker","name":"🧙"},
  {"id":"facilities","name":"🔧"},
  {"id":"frontdesk","name":"🛎️"},
  {"id":"athletics","name":"🏅"},
  {"id":"nurse","name":"🩺"},
]}
MIME = {".html":"text/html",".js":"text/javascript",".css":"text/css",".svg":"image/svg+xml",".json":"application/json"}
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split('?')[0]
        if path == '/api/leaves':
            b = json.dumps(LEAVES).encode(); self.send_response(200); self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(b))); self.end_headers(); self.wfile.write(b); return
        rel = path.lstrip('/');
        if not rel: rel='index.html'
        fp = os.path.join(ROOT, rel)
        if not os.path.isfile(fp): fp = os.path.join(ROOT,'index.html')
        with open(fp,'rb') as f: d=f.read()
        self.send_response(200); self.send_header('Content-Type',MIME.get(os.path.splitext(fp)[1],'application/octet-stream')); self.send_header('Content-Length',str(len(d))); self.end_headers(); self.wfile.write(d)
    def log_message(self,*a): pass
http.server.HTTPServer(('127.0.0.1',PORT),H).serve_forever()