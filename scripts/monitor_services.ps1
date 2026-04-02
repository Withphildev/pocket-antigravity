# Porta Service Monitor & Auto-Restarter
# Checks health every 30 minutes and restarts services if they are down.

$CHECK_INTERVAL_SECONDS = 1800 # 30 minutes
$API_URL = "http://127.0.0.1:3170/api/health"
$PROJECT_ROOT = "d:\NovaSDK\Porta"

function Restart-Services {
    Write-Host "$(Get-Date): Service health check failed. Restarting services..."
    
    # 1. Kill any stray processes related to the dev environment
    Write-Host "Cleaning up old processes..."
    Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*dev-cloud.mjs*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Get-Process -Name cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    
    # 2. Wait a moment for ports to free up
    Start-Sleep -Seconds 5
    
    # 3. Launch dev:cloud in a fresh, minimized window
    Write-Host "Launching pnpm dev:cloud..."
    Set-Location $PROJECT_ROOT
    Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass", "-NoExit", "-Command", "pnpm dev:cloud" -WindowStyle Minimized
    
    Write-Host "Services restarted."
}

Write-Host "Starting Porta health monitor (checking every $CHECK_INTERVAL_SECONDS seconds)..."

while ($true) {
    try {
        # Check local health endpoint
        $response = Invoke-RestMethod -Uri $API_URL -TimeoutSec 10 -ErrorAction Stop
        if ($response.status -eq "ok") {
            Write-Host "$(Get-Date): Status OK. Languages Servers found: $($response.languageServers.Count)"
        } else {
            Restart-Services
        }
    } catch {
        # If API is unreachable or returns error
        Restart-Services
    }
    
    Start-Sleep -Seconds $CHECK_INTERVAL_SECONDS
}
