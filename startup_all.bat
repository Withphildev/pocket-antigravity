@echo off
echo Starting Antigravity Pocket Bridge Services...
cd /d "d:\NovaSDK\Porta"
start "Pocket Antigravity PWA + Proxy" pnpm dev
timeout /t 5
cd /d "d:\NovaSDK\ShipEngine Antigravity\apps\nova-control-panel"
start "Nova Control Panel" python main.py
echo Services launched!
timeout /t 2
exit
