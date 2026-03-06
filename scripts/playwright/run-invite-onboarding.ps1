param(
  [switch]$Headed
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
Add-Type -AssemblyName System.Net.Http

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$runStamp = Get-Date -Format "yyyy-MM-ddTHH-mm-ss-fff"
$artifactDir = Join-Path $repoRoot "output\playwright"
$dataDir = Join-Path $repoRoot ".tmp\playwright-data\$runStamp"
$serverPort = 3301
$vitePort = 3300
$baseUrl = "http://127.0.0.1:$vitePort"
$serverOutLog = Join-Path $artifactDir "$runStamp-server.out.log"
$serverErrLog = Join-Path $artifactDir "$runStamp-server.err.log"
$viteOutLog = Join-Path $artifactDir "$runStamp-vite.out.log"
$viteErrLog = Join-Path $artifactDir "$runStamp-vite.err.log"

function New-CleanDir {
  param([string]$Path)

  if (Test-Path $Path) {
    Remove-Item -Path $Path -Recurse -Force
  }

  New-Item -ItemType Directory -Path $Path -Force | Out-Null
}

function Wait-HttpReady {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 60
  )

  $client = [System.Net.Http.HttpClient]::new()
  $client.Timeout = [TimeSpan]::FromSeconds(5)
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  try {
    while ((Get-Date) -lt $deadline) {
      try {
        $response = $client.GetAsync($Url).GetAwaiter().GetResult()
        if ($null -ne $response) {
          return
        }
      } catch {
      }

      Start-Sleep -Milliseconds 500
    }
  } finally {
    $client.Dispose()
  }

  throw "Timed out waiting for $Url"
}

function Start-RepoProcess {
  param(
    [string]$Command,
    [string]$StdoutPath,
    [string]$StderrPath
  )

  Start-Process powershell `
    -WorkingDirectory $repoRoot `
    -PassThru `
    -WindowStyle Hidden `
    -ArgumentList @(
      "-NoLogo",
      "-NoProfile",
      "-Command",
      $Command
    ) `
    -RedirectStandardOutput $StdoutPath `
    -RedirectStandardError $StderrPath
}

function Stop-ProcessesOnPort {
  param([int[]]$Ports)

  $processIds = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue `
    | Where-Object { $Ports -contains $_.LocalPort } `
    | Select-Object -ExpandProperty OwningProcess -Unique

  foreach ($processId in $processIds) {
    try {
      Stop-Process -Id $processId -Force -ErrorAction Stop
    } catch {
    }
  }
}

New-Item -ItemType Directory -Path $artifactDir -Force | Out-Null
New-Item -ItemType Directory -Path $dataDir -Force | Out-Null

$serverProcess = $null
$viteProcess = $null

try {
  Stop-ProcessesOnPort -Ports @($serverPort, $vitePort)

  $serverCommand = @"
`$env:DATA_DIR = '$dataDir'
`$env:SERVER_PORT = '$serverPort'
`$env:COOKIE_SECURE = 'false'
`$env:XUI_AUTO_CREATE_ON_REGISTER = 'false'
npm run server
"@

  $viteCommand = @"
`$env:SERVER_PORT = '$serverPort'
`$env:VITE_SUB_URL = 'http://127.0.0.1:2096'
npx vite --host 127.0.0.1 --port $vitePort
"@

  $serverProcess = Start-RepoProcess `
    -Command $serverCommand `
    -StdoutPath $serverOutLog `
    -StderrPath $serverErrLog
  Wait-HttpReady -Url "http://127.0.0.1:$serverPort/local/auth/me" -TimeoutSeconds 60

  $viteProcess = Start-RepoProcess `
    -Command $viteCommand `
    -StdoutPath $viteOutLog `
    -StderrPath $viteErrLog
  Wait-HttpReady -Url "$baseUrl/login" -TimeoutSeconds 60

  $scriptArgs = @(
    "run",
    "pw:flow",
    "--",
    "--base-url",
    $baseUrl,
    "--data-dir",
    $dataDir,
    "--artifact-dir",
    $artifactDir
  )

  if ($Headed) {
    $scriptArgs += "--headed"
  }

  & npm @scriptArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Playwright flow failed with exit code $LASTEXITCODE"
  }
} finally {
  if ($viteProcess -and -not $viteProcess.HasExited) {
    Stop-Process -Id $viteProcess.Id -Force
  }

  if ($serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force
  }
}
