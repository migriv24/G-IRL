# Creates a desktop shortcut that launches IRL_Window and opens the browser.
# Run once: right-click -> "Run with PowerShell"

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$StartScript = Join-Path $ProjectDir "start.bat"
$IconPath    = Join-Path $ProjectDir "irl_window.ico"
$ShortcutPath = [System.IO.Path]::Combine(
    [Environment]::GetFolderPath("Desktop"),
    "IRL_Window.lnk"
)

# Download a simple icon if none exists (uses PowerShell's built-in web client)
# Falls back to the default cmd icon if this fails — no big deal
if (-not (Test-Path $IconPath)) {
    try {
        # Use the Python executable icon as a reasonable stand-in
        $PythonExe = (Get-Command python -ErrorAction SilentlyContinue).Source
        if ($PythonExe) { $IconPath = $PythonExe }
    } catch {}
}

$WScriptShell = New-Object -ComObject WScript.Shell
$Shortcut = $WScriptShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath      = $StartScript
$Shortcut.WorkingDirectory = $ProjectDir
$Shortcut.Description     = "Launch IRL_Window (backend + frontend)"
$Shortcut.WindowStyle     = 1   # Normal window

if (Test-Path $IconPath) {
    $Shortcut.IconLocation = "$IconPath,0"
}

$Shortcut.Save()

Write-Host ""
Write-Host "Shortcut created at: $ShortcutPath" -ForegroundColor Green
Write-Host ""
Write-Host "Double-click 'IRL_Window' on your desktop to start." -ForegroundColor Cyan
Write-Host "It will open two terminal windows (backend + frontend) then navigate to http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
