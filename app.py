"""WSGI entrypoint for Vercel; local HTTP server remains available."""
import io
import logging
import os
from email.message import Message

from flask import Flask, Response, request, send_from_directory
from backend.db import default_db_path
from backend.server import FRONTEND_ROOT, PROJECT_ROOT, make_handler

app = Flask(__name__, static_folder=None)
app.config["MAX_CONTENT_LENGTH"] = 1_000_000


@app.route("/api/<path:path>", methods=["GET", "POST", "DELETE", "HEAD", "PUT", "PATCH", "OPTIONS"])
def api_route(path):
    target = app.config.get("DATABASE_TARGET") or default_db_path(PROJECT_ROOT)
    if os.environ.get("VERCEL") and not str(target).startswith(("postgres://", "postgresql://")):
        return {"error": "Banco online não configurado."}, 503
    if request.method not in ("GET", "POST", "DELETE"):
        return {"error": "Método não permitido."}, 405
    # Reuse the domain/API implementation without starting a listening server.
    handler_class = make_handler(target)
    handler = handler_class.__new__(handler_class)
    handler.path = request.full_path.rstrip("?")
    handler.headers = Message()
    for name, value in request.headers.items():
        handler.headers[name] = value
    handler.rfile = io.BytesIO(request.get_data())
    handler.wfile = io.BytesIO()
    headers = []
    result = {"status": 500}
    handler.send_response = lambda status: result.update(status=status)
    handler.send_header = lambda name, value: headers.append((name, value))
    handler.end_headers = lambda: None
    handler.log_error = lambda *_args: logging.error("AlertaBairro API request failed")
    handler.api(request.method)
    return Response(handler.wfile.getvalue(), status=result["status"], headers=headers)


@app.route("/", defaults={"path": "index.html"})
@app.route("/<path:path>")
def frontend(path):
    return send_from_directory(FRONTEND_ROOT, path)


@app.after_request
def security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-Frame-Options"] = "DENY"
    return response
