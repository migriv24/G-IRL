# Creates a desktop shortcut that launches IRL_Window and opens the browser.
# Run once: right-click -> "Run with PowerShell"

$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir        # G-IRL/
$StartScript = Join-Path $ScriptDir "start.bat"
$IconPath    = Join-Path $ProjectRoot "assets\icon.ico"
$ShortcutPath = [System.IO.Path]::Combine(
    [Environment]::GetFolderPath("Desktop"),
    "IRL_Window.lnk"
)

if (-not (Test-Path $IconPath)) {
    Write-Warning "Icon not found at: $IconPath"
    Write-Warning "Shortcut will use default icon."
    $IconPath = $null
}

$WScriptShell = New-Object -ComObject WScript.Shell
$Shortcut = $WScriptShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath       = $StartScript
$Shortcut.WorkingDirectory = $ScriptDir
$Shortcut.Description      = "IRL_Window - Synthetic Data Platform"
$Shortcut.WindowStyle      = 1   # Normal window

if ($IconPath) {
    $Shortcut.IconLocation = "$IconPath,0"
}

$Shortcut.Save()

Write-Host ""
Write-Host "Desktop shortcut created: $ShortcutPath" -ForegroundColor Green
Write-Host "Icon:  $IconPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "Double-click 'IRL_Window' on your desktop to start." -ForegroundColor Cyan
Write-Host "Opens backend (port 8000) + frontend (port 5173) + browser." -ForegroundColor Cyan

Write-Host ""
