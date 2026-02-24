@echo off
echo Starting Backend Server...
start cmd /k "cd /d C:\Marqland\catalogue_website\catalogue_source_code\backend && node server.js"

echo Starting Frontend React App...
start cmd /k "cd /d C:\Marqland\catalogue_website\catalogue_source_code\frontend && npm start"

echo Application processes launched.