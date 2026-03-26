$listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1

if (-not $listener) {
  Write-Host "No backend process is listening on port 3000."
  exit 0
}

try {
  Stop-Process -Id $listener.OwningProcess -Force
  Write-Host "Stopped backend process on port 3000 (PID: $($listener.OwningProcess))."
} catch {
  Write-Host "Failed to stop backend process (PID: $($listener.OwningProcess)). Try running PowerShell as Administrator."
  exit 1
}
