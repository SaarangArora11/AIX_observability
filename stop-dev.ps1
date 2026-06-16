<#
.SYNOPSIS
    Stop all Refract development services and infrastructure.
#>

$ProjectRoot = $PSScriptRoot
if (-not $ProjectRoot) { $ProjectRoot = Get-Location }

Write-Host ""
Write-Host "Stopping Refract Development Environment..." -ForegroundColor Yellow
Write-Host ""

# Stop any bun/node processes on the service ports
$ports = @(8080, 8081, 8082, 8090, 3000)
foreach ($port in $ports) {
    $process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -ErrorAction SilentlyContinue
    if ($process) {
        foreach ($procId in ($process | Select-Object -Unique)) {
            $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
            if ($proc -and $proc.ProcessName -match "bun|node") {
                Write-Host "  Stopping $($proc.ProcessName) on port $port (PID: $procId)..." -ForegroundColor Gray
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

# Stop Docker infrastructure
Write-Host "  Stopping Docker infrastructure..." -ForegroundColor Gray
$composeFile = Join-Path $ProjectRoot "infra/docker/docker-compose.yml"
docker compose -f $composeFile down 2>&1 | Out-Null

Write-Host ""
Write-Host "  ✅ All services stopped" -ForegroundColor Green
Write-Host ""
