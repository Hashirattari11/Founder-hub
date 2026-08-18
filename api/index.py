"""Vercel Serverless Function — FounderHub API.

Vercel auto-detects Python files in the api/ directory and deploys them
as serverless functions. This thin wrapper imports the FastAPI app from
the backend so /api/* routes work alongside the Vite static frontend.
"""

import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(_HERE)
sys.path.insert(0, os.path.join(_ROOT, "backend"))

from dotenv import load_dotenv

_dotenv_path = os.path.join(_ROOT, "backend", ".env")
if os.path.exists(_dotenv_path):
    load_dotenv(_dotenv_path)

from app.main import app  # noqa: E402
