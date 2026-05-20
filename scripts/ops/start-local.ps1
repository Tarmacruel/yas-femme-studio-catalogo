[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Storage = Join-Path $Root "storage"
$Logs = Join-Path $Storage "logs"
$Runtime = Join-Path $Storage "runtime"
$PidFile = Join-Path $Runtime "app.pid"
$OutLog = Join-Path $Logs "app.out.log"
$ErrLog = Join-Path $Logs "app.err.log"
$Port = 5000

function Ensure-Dir([string]$Path) {
  if (-not (Test-Path $Path)) {
    New-Item -ItemType Directory -Force -Path $Path | Out-Null
  }
}

function Get-Npm {
  $cmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  throw "npm.cmd nao foi encontrado no PATH."
}

function Get-PortOwners([int]$Port) {
  @(Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" } | Select-Object -ExpandProperty OwningProcess -Unique)
}

function Wait-Health {
  $deadline = (Get-Date).AddSeconds(30)
  while ((Get-Date) -lt $deadline) {
    try {
      Invoke-WebRequest -Uri "http://localhost:$Port/health" -UseBasicParsing -TimeoutSec 3 | Out-Null
      return $true
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }
  return $false
}

Set-Location $Root
Ensure-Dir $Storage
Ensure-Dir $Logs
Ensure-Dir $Runtime

if (-not (Test-Path (Join-Path $Root ".env")) -and (Test-Path (Join-Path $Root ".env.example"))) {
  Copy-Item -LiteralPath (Join-Path $Root ".env.example") -Destination (Join-Path $Root ".env")
  Write-Host "Arquivo .env criado a partir do .env.example. Ajuste ADMIN_PASSWORD quando desejar."
}

if (-not (Test-Path (Join-Path $Root "node_modules"))) {
  Write-Host "Dependencias ausentes. Executando npm install..."
  & (Get-Npm) install
  if ($LASTEXITCODE -ne 0) { throw "npm install falhou." }
}

$owners = @(Get-PortOwners $Port)
if ($owners.Count -gt 0) {
  Write-Host "Yas Femme Studio ja esta usando a porta $Port (PID $($owners -join ', '))."
  Write-Host "Site: http://localhost:$Port"
  exit 0
}

if (-not (Test-Path $OutLog)) { Set-Content -LiteralPath $OutLog -Value "" -Encoding utf8 }
if (-not (Test-Path $ErrLog)) { Set-Content -LiteralPath $ErrLog -Value "" -Encoding utf8 }

$process = Start-Process -FilePath (Get-Npm) `
  -ArgumentList @("run", "start") `
  -WorkingDirectory $Root `
  -RedirectStandardOutput $OutLog `
  -RedirectStandardError $ErrLog `
  -WindowStyle Hidden `
  -PassThru

Set-Content -LiteralPath $PidFile -Value ([string]$process.Id) -Encoding ascii

if (-not (Wait-Health)) {
  throw "O app iniciou, mas nao respondeu em http://localhost:$Port/health. Veja os logs em $Logs."
}

$ownersAfterStart = @(Get-PortOwners $Port)
if ($ownersAfterStart.Count -gt 0) {
  Set-Content -LiteralPath $PidFile -Value ([string]$ownersAfterStart[0]) -Encoding ascii
}

Write-Host "Yas Femme Studio iniciado."
Write-Host "Site:  http://localhost:$Port"
Write-Host "Admin: http://localhost:$Port/admin"
Write-Host "Tunnel esperado: https://yasfemmestudio.sirel.com.br"
