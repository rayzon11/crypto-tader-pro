# scripts/deploy.ps1 — Deploy via Docker Compose on Windows
param(
    [string]$Action = "up",       # up | down | restart | logs | status
    [string]$Profile = "prod",    # prod | dev | backtest
    [switch]$Build = $false,
    [switch]$Pull = $false
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ComposeFile = Join-Path $Root "docker\docker-compose.yml"
$EnvFile = Join-Path $Root ".env"

Write-Host "CRYPTO BOT DEPLOY" -ForegroundColor Cyan
Write-Host "Action: $Action | Profile: $Profile" -ForegroundColor Yellow

if (-not (Get-Command "docker" -ErrorAction SilentlyContinue)) {
    Write-Host "Docker not found. Install Docker Desktop." -ForegroundColor Red; exit 1
}
if (-not (Test-Path $EnvFile)) {
    Write-Host ".env not found at $EnvFile" -ForegroundColor Red; exit 1
}

$Base = "docker compose -f `"$ComposeFile`" --env-file `"$EnvFile`""

function Run([string]$Args) {
    $cmd = "$Base $Args"
    Write-Host "> $cmd" -ForegroundColor DarkGray
    Invoke-Expression $cmd
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

switch ($Action) {
    "up"      { if ($Pull) { Run "pull" }; if ($Build) { Run "build --no-cache" }
                Run "up -d --remove-orphans"; Run "ps" }
    "down"    { Run "down -v" }
    "restart" { Run "restart" }
    "logs"    { Run "logs -f --tail=100" }
    "status"  { Run "ps" }
    default   { Write-Host "Unknown action: $Action" -ForegroundColor Red; exit 1 }
}

Write-Host "Done. Dashboard: http://localhost:3000" -ForegroundColor Green
