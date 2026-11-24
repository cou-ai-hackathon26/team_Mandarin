@echo off
title TicketX Localhost Server
echo =======================================================
echo   TicketX - Safe Ticket Reselling Platform Prototype
echo =======================================================
echo.

REM ===== Paste your Gemini API key after the = sign (no spaces, no quotes) =====
set GEMINI_API_KEY=GEMINI_API_KEY

REM ===== FREE backup AI: Groq key from https://console.groq.com/keys (starts with gsk_) =====
REM Used automatically when Gemini is busy (503) or fails.
set GROQ_API_KEY=YOUR GROQ_API_KEY
REM Optional model override: set GEMINI_MODEL=gemini-3.5-flash

echo Starting server on http://localhost:3000 ...
echo Press Ctrl+C anytime to stop.
echo.
cd /d "%~dp0"
node server.js
pause