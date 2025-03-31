@echo off
title Backend Server

echo Starting Python Flask server...

REM Change directory to the script's location
cd /d "%~dp0"

REM --- Optional: Activate Virtual Environment ---
REM If you use a virtual environment, uncomment and adjust the line below:
REM call venv\Scripts\activate
REM echo Virtual environment activated.

REM --- Run the backend script ---
echo Running backend.py...
python backend.py

echo Server stopped.
pause