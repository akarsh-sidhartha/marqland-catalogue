@echo off
echo Starting Backend Server...
start cmd /k "cd /d E:\Marqland_Studios\marqland-catalogue\backend && node server.js"

echo Starting Frontend React App...
start cmd /k "cd /d E:\Marqland_Studios\marqland-catalogue\frontend && npm start"

echo Application processes launched.