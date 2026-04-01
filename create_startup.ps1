$ws = New-Object -ComObject WScript.Shell
$startupPath = [System.IO.Path]::Combine([System.Environment]::GetFolderPath('Startup'), "Antigravity_Startup.lnk")
$shortcut = $ws.CreateShortcut($startupPath)
$shortcut.TargetPath = "d:\NovaSDK\Porta\startup_all.bat"
$shortcut.WorkingDirectory = "d:\NovaSDK\Porta"
$shortcut.Save()
Write-Host "Startup shortcut created in $startupPath"
