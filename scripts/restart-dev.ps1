param(
  [switch]$DebugProxy
)

$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $projectRoot

if ($DebugProxy) {
  $env:PROXY_DEBUG = 'true'
}

if (-not (Test-Path '.tmp')) {
  New-Item -ItemType Directory -Path '.tmp' | Out-Null
}

function Stop-ProcessByPort {
  param([int]$Port)
  $lines = netstat -ano | Select-String ":$Port\\s+.*LISTENING"
  foreach ($line in $lines) {
    $parts = ($line.ToString() -replace '\s+', ' ').Trim().Split(' ')
    $pid = [int]$parts[-1]
    if ($pid -gt 0) {
      try { Stop-Process -Id $pid -Force -ErrorAction Stop } catch {}
    }
  }
}

function Stop-ProjectProcesses {
  $targets = Get-CimInstance Win32_Process | Where-Object {
    ($_.Name -in @('node.exe', 'cmd.exe')) -and (
      ($_.CommandLine -like '*DMITProxy*vite*') -or
      ($_.CommandLine -like '*DMITProxy*server/index.ts*') -or
      ($_.CommandLine -like '*npm run dev*') -or
      ($_.CommandLine -like '*npm run server:watch*')
    )
  }

  $targets | Sort-Object ProcessId -Descending | ForEach-Object {
    try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {}
  }
}

Stop-ProjectProcesses
Stop-ProcessByPort -Port 3000
Stop-ProcessByPort -Port 3001

Remove-Item '.tmp\server-watch.out.log', '.tmp\server-watch.err.log', '.tmp\vite-dev.out.log', '.tmp\vite-dev.err.log' -ErrorAction SilentlyContinue

$server = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'npm run server:watch' -WorkingDirectory $projectRoot -RedirectStandardOutput '.tmp\server-watch.out.log' -RedirectStandardError '.tmp\server-watch.err.log' -PassThru
$vite = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'npm run dev' -WorkingDirectory $projectRoot -RedirectStandardOutput '.tmp\vite-dev.out.log' -RedirectStandardError '.tmp\vite-dev.err.log' -PassThru

Set-Content -Path '.tmp\server-watch.pid' -Value $server.Id
Set-Content -Path '.tmp\vite-dev.pid' -Value $vite.Id

Start-Sleep -Seconds 2

Write-Output "Restarted dev services."
Write-Output "server:watch PID=$($server.Id)"
Write-Output "vite dev PID=$($vite.Id)"
Write-Output ""
Write-Output "Listening ports:"
netstat -ano | Select-String ':3000|:3001'
Write-Output ""
Write-Output "Tail logs:"
Write-Output "  Get-Content .tmp\\server-watch.out.log -Wait"
Write-Output "  Get-Content .tmp\\vite-dev.out.log -Wait"
