@echo off
title FounderHub Backend
cd /d "D:\founderhub\backend"
echo Starting FounderHub API on http://localhost:8001
echo Keep this window open. Close it to stop the backend.
echo.
"C:\Users\AAMASH\AppData\Local\Programs\Python\Python312\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8001
pause
