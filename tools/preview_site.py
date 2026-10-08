#!/usr/bin/env python3
"""Serve the Sloop preview on its dedicated port, with room for browser bursts."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse

class PreviewServer(ThreadingHTTPServer):
    # Windows browsers open many asset connections together; the default queue
    # of five can reset them before the handler gets a chance to accept them.
    request_queue_size = 128

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8769)
    parser.add_argument('--directory', type=Path, default=Path(__file__).resolve().parents[1] / 'build' / 'site')
    args = parser.parse_args()
    with PreviewServer(('127.0.0.1', args.port), partial(SimpleHTTPRequestHandler, directory=str(args.directory.resolve()))) as server:
        print(f'Sloop preview: http://127.0.0.1:{args.port}/webapp/editor/', flush=True)
        server.serve_forever()
