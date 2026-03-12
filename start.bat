@echo off

:: Create desktop shortcut on first run
set SHORTCUT=%USERPROFILE%\Desktop\SubSync.lnk
set TARGET=%~dp0start.bat

if not exist "%SHORTCUT%" (
    powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT%'); $s.TargetPath = '%TARGET%'; $s.IconLocation = '%~dp0AppLogo.ico'; $s.Save()"
    echo Shortcut created on Desktop!
)

start node server.js
timeout /t 2
start http://localhost:3000