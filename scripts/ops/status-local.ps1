[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Logs = Join-Path $Root "storage\logs"
$PidFile = Join-Path $Root "storage\runtime\app.pid"
$Port = 5000

$pidValue = $null
if (Test-Path $PidFile) {
  $raw = (Get-Content -Raw -LiteralPath $PidFile).Trim()
  $parsed = 0
  if ([int]::TryParse($raw, [ref]$parsed)) {
    if (Get-Process -Id $parsed -ErrorAction SilentlyContinue) {
      $pidValue = $parsed
    }
  }
}

$portOwners = @(Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" } | Select-Object -ExpandProperty OwningProcess -Unique)

Write-Host "Status Yas Femme Studio"
Write-Host "-----------------------"
Write-Host "Site:  http://localhost:$Port"
Write-Host "Admin: http://localhost:$Port/admin"
Write-Host "PID registrado: $(if ($pidValue) { $pidValue } else { 'nenhum' })"
Write-Host "Porta ${Port}: $(if ($portOwners.Count -gt 0) { 'em uso por PID ' + ($portOwners -join ', ') } else { 'livre' })"
Write-Host "Logs: $Logs"
