#!/bin/sh

echo "Starting Python Flask server..."
cd "$(dirname "$0")"
echo "Running backend.py..."
python backend.py
echo "Server stopped."