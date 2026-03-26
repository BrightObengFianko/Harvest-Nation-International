$ErrorActionPreference = "Stop"

$projectDir = "C:\Users\Admin\OneDrive\Desktop\brights\bright"
$nodeExe = "C:\Program Files\nodejs\node.exe"
$serverScript = Join-Path $projectDir "server.js"
$healthUrl = "http://127.0.0.1:3000/api/health"

if (-not (Test-Path $nodeExe)) {
  Write-Host "Node.js was not found at: $nodeExe"
  exit 1
}

if (-not (Test-Path $serverScript)) {
  Write-Host "server.js was not found at: $serverScript"
  exit 1
}

try {
  $listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($listener) {
    Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 700
  }
} catch {
  Write-Host "Could not pre-stop existing port 3000 process. Continuing..."
}

if (Test-Path Env:PATH) {
  Remove-Item Env:PATH -ErrorAction SilentlyContinue
}

$process = Start-Process `
  -FilePath $nodeExe `
  -ArgumentList $serverScript `
  -WorkingDirectory $projectDir `
  -WindowStyle Hidden `
  -PassThru

$isHealthy = $false
for ($i = 0; $i -lt 10; $i++) {
  Start-Sleep -Milliseconds 500
  try {
    $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
    if ($health.ok -eq $true) {
      $isHealthy = $true
      break
    }
  } catch {
    # keep trying
  }
}

if ($isHealthy) {
  Write-Host "Backend online at http://127.0.0.1:3000 (PID: $($process.Id))"
} else {
  Write-Host "Backend did not come online in time. Check server.js and port 3000."
  exit 1
}
