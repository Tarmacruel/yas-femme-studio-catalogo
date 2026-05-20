[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Runtime = Join-Path $Root "storage\runtime"
$PidFile = Join-Path $Runtime "app.pid"
$Port = 5000

function Stop-ProcessTree([int]$ProcessId) {
  if ($ProcessId -le 0) { return }
  $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
  if (-not $process) { return }
  try {
    & taskkill.exe /PID $ProcessId /T /F *> $null
    $global:LASTEXITCODE = 0
  } catch {
  }
}

$pids = @()
if (Test-Path $PidFile) {
  $raw = (Get-Content -Raw -LiteralPath $PidFile).Trim()
  $pidValue = 0
  if ([int]::TryParse($raw, [ref]$pidValue)) {
    $pids += $pidValue
  }
}

$portPids = @(Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" } | Select-Object -ExpandProperty OwningProcess -Unique)
$pids += $portPids
$pids = @($pids | Where-Object { $_ } | Sort-Object -Unique)

if ($pids.Count -eq 0) {
  Write-Host "Nenhum processo do Yas Femme Studio encontrado."
} else {
  foreach ($pidValue in $pids) {
    Write-Host "Parando PID $pidValue..."
    Stop-ProcessTree ([int]$pidValue)
  }
}

Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
Write-Host "Yas Femme Studio parado."
