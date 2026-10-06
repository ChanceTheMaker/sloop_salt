#!/usr/bin/env python3
"""Serve the Sloop preview on its dedicated port, with room for browser bursts."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

class PreviewServer(ThreadingHTTPServer):
    # Windows browsers open many asset connections together; the default queue
    # of five can reset them before the handler gets a chance to accept them.
    request_queue_size = 128

if __name__ == '__main__':
    directory = Path(__file__).resolve().parents[1] / 'build' / 'site'
    with PreviewServer(('127.0.0.1', 8769), partial(SimpleHTTPRequestHandler, directory=str(directory))) as server:
        print('Sloop preview: http://127.0.0.1:8769/webapp/editor/', flush=True)
        server.serve_forever()
