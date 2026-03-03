#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

echo "===================================================================="
echo " ShengMo Backend Launcher - v2 (with Auto-Dependency Install)"
echo "===================================================================="
echo ""

export PYTHONIOENCODING=utf-8

# Step 1: Check for npm command
echo "Checking for npm..."
if ! command -v npm &> /dev/null
then
    echo ""
    echo "[ERROR] FATAL: 'npm' command not found."
    echo "Please install Node.js (which includes npm) and ensure it is in your system's PATH."
    echo "Node.js is required to run this project's startup scripts."
    echo ""
    exit 1
fi
echo "Found npm."
echo ""

# Step 2: Check for node_modules and install if missing
echo "Checking for dependencies (node_modules directory)..."
if [ ! -d "node_modules" ]; then
    echo "'node_modules' directory not found. Running 'npm install' to fetch dependencies."
    echo "This might take a moment..."
    echo ""
    npm install
    if [ $? -ne 0 ]; then
        echo ""
        echo "[ERROR] 'npm install' failed. Please check the error messages above."
        echo "Cannot start the servers."
        echo ""
        exit 1
    fi
    echo "'npm install' completed successfully."
else
    echo "'node_modules' directory exists. Skipping install."
fi
echo ""

# Step 3: Start the servers
echo "Starting backend services using 'npm start'..."
echo "The services will run in this terminal window."
echo "Press Ctrl+C to stop all services."
echo ""

npm start