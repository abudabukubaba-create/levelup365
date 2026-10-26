from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import json
import os

BASE = Path(__file__).parent
DATA = BASE / "data" / "progress.json"

DEFAULT = {
    "date": "",
    "tasks": [],
    "xp": 0,
    "streak": 0,
    "days": {},
    "words": [],
    "weight": "",
    "notes": ""
}

def load_data():
    try:
        return json.loads(DATA.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return DEFAULT.copy()

def save_data(data):
    DATA.parent.mkdir(parents=True, exist_ok=True)
    temp = DATA.with_suffix(".tmp")
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    temp.replace(DATA)

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE / "static"), **kwargs)

    def do_GET(self):
        if self.path == "/api/state":
            self.send_json(load_data())
            return
        if self.path == "/":
            self.path = "/index.html"
        return super().do_GET()

    def do_POST(self):
        if self.path != "/api/state":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length > 200_000:
                self.send_error(413)
                return
            incoming = json.loads(self.rfile.read(length))
            if not isinstance(incoming, dict):
                raise ValueError("Invalid data")
            old = load_data()
            data = {**DEFAULT, **old, **incoming}
            save_data(data)
            self.send_json({"ok": True, "data": data})
        except (ValueError, TypeError, json.JSONDecodeError):
            self.send_error(400, "Invalid JSON")

    def send_json(self, obj):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        print("[LEVEL UP]", fmt % args)

if __name__ == "__main__":
    os.chdir(BASE)
    print("\nLEVEL UP 365 ishga tushmoqda...")
    print("Brauzerda och: http://127.0.0.1:8000")
    print("To'xtatish: CTRL+C\n")
    port = int(os.environ.get("PORT", "8000"))
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
