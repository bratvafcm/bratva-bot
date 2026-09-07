@echo off
title БРАТВА FCM League Telegram Bot
echo ========================================================
echo   STARTING БРАТВА FCM LEAGUE TELEGRAM BOT (@BratvaFCMBot)
echo ========================================================
cd /d "%~dp0"
node telegram-bot/bot.cjs
pause
