<#
.SYNOPSIS
    Refract Development Startup Script
    Starts all infrastructure and microservices for local development.

.DESCRIPTION
    This script handles:
    1. Building workspace packages (config, schema, core, sdk, database)
    2. Starting infrastructure (PostgreSQL, NATS, Redis) via Docker
    3. Pushing database schema via Drizzle
    4. Launching all microservices in separate windows
    5. Launching the dashboard UI

.NOTES
    Prerequisites: Docker Desktop, Bun, Node.js
    Run from the project root directory.
#>

param(
    [switch]$SkipBuild,
    [switch]$SkipInfra,
    [switch]$SkipSchema,
    [switch]$InfraOnly
)

$ErrorActionPreference = "Continue"
$ProjectRoot = $PSScriptRoot
if (-not $ProjectRoot) { $ProjectRoot = Get-Location }

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Refract Development Environment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ─────────────────────────────────────────────────────────────────────
# Load environment variables from .env
# ─────────────────────────────────────────────────────────────────────
$envFile = Join-Path $ProjectRoot ".env"
if (Test-Path $envFile) {
    Write-Host "[1/6] Loading environment from .env..." -ForegroundColor Yellow
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#")) {
            # Split on first = only
            $eqIndex = $line.IndexOf("=")
            if ($eqIndex -gt 0) {
                $key = $line.Substring(0, $eqIndex).Trim()
                $value = $line.Substring($eqIndex + 1).Trim()
                [System.Environment]::SetEnvironmentVariable($key, $value, "Process")
            }
        }
    }
    Write-Host "  ✅ Environment loaded" -ForegroundColor Green
} else {
    Write-Host "[1/6] No .env file found, creating from .env.example..." -ForegroundColor Yellow
    Copy-Item (Join-Path $ProjectRoot ".env.example") $envFile
    Write-Host "  ⚠️  Created .env from .env.example - please review settings" -ForegroundColor DarkYellow
}

# ─────────────────────────────────────────────────────────────────────
# Step 2: Build workspace packages
# ─────────────────────────────────────────────────────────────────────
if (-not $SkipBuild) {
    Write-Host ""
    Write-Host "[2/6] Building workspace packages..." -ForegroundColor Yellow
    
    Push-Location $ProjectRoot
    
    # Install dependencies
    Write-Host "  Installing dependencies..." -ForegroundColor Gray
    bun install 2>&1 | Out-Null
    
    # Build packages in dependency order
    $packages = @(
        @{ Name = "config";   Path = "packages/config" },
        @{ Name = "schema";   Path = "packages/schema" },
        @{ Name = "core";     Path = "packages/core" },
        @{ Name = "sdk";      Path = "packages/sdk" },
        @{ Name = "database"; Path = "packages/database" }
    )
    
    foreach ($pkg in $packages) {
        Write-Host "  Building @refract/$($pkg.Name)..." -ForegroundColor Gray
        Push-Location (Join-Path $ProjectRoot $pkg.Path)
        $output = bun run build 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ❌ Failed to build @refract/$($pkg.Name)" -ForegroundColor Red
            Write-Host $output -ForegroundColor Red
            Pop-Location
            Pop-Location
            exit 1
        }
        Pop-Location
    }
    
    Pop-Location
    Write-Host "  ✅ All packages built successfully" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "[2/6] Skipping package builds (--SkipBuild)" -ForegroundColor DarkGray
}

# ─────────────────────────────────────────────────────────────────────
# Step 3: Start infrastructure (Docker)
# ─────────────────────────────────────────────────────────────────────
if (-not $SkipInfra) {
    Write-Host ""
    Write-Host "[3/6] Starting infrastructure (PostgreSQL, NATS, Redis)..." -ForegroundColor Yellow
    
    $composeFile = Join-Path $ProjectRoot "infra/docker/docker-compose.yml"
    docker compose -f $composeFile up -d postgres nats redis 2>&1 | Out-Null
    
    # Wait for services to be healthy
    Write-Host "  Waiting for services to be healthy..." -ForegroundColor Gray
    $maxRetries = 30
    $retry = 0
    do {
        Start-Sleep -Seconds 2
        $retry++
        $pgReady = docker exec refract-postgres pg_isready -U refract 2>&1
        if ($pgReady -match "accepting connections") { break }
    } while ($retry -lt $maxRetries)
    
    if ($retry -ge $maxRetries) {
        Write-Host "  ❌ PostgreSQL failed to start" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "  ✅ Infrastructure is healthy" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "[3/6] Skipping infrastructure startup (--SkipInfra)" -ForegroundColor DarkGray
}

# ─────────────────────────────────────────────────────────────────────
# Step 4: Push database schema
# ─────────────────────────────────────────────────────────────────────
if (-not $SkipSchema) {
    Write-Host ""
    Write-Host "[4/6] Pushing database schema..." -ForegroundColor Yellow
    
    Push-Location (Join-Path $ProjectRoot "packages/database")
    $output = npx drizzle-kit push --force 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ⚠️  Schema push had issues (may be OK if tables already exist)" -ForegroundColor DarkYellow
    } else {
        Write-Host "  ✅ Database schema pushed" -ForegroundColor Green
    }
    Pop-Location
} else {
    Write-Host ""
    Write-Host "[4/6] Skipping schema push (--SkipSchema)" -ForegroundColor DarkGray
}

if ($InfraOnly) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Infrastructure Ready (--InfraOnly)" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  PostgreSQL: localhost:5433" -ForegroundColor White
    Write-Host "  NATS:       localhost:4222" -ForegroundColor White
    Write-Host "  Redis:      localhost:6379" -ForegroundColor White
    Write-Host ""
    exit 0
}

# ─────────────────────────────────────────────────────────────────────
# Step 5: Start microservices in separate windows
# ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[5/6] Starting microservices..." -ForegroundColor Yellow

# Build environment variable string for passing to new windows
$envVars = @(
    "DATABASE_URL=$($env:DATABASE_URL)",
    "REDIS_URL=$($env:REDIS_URL)",
    "NATS_URL=$($env:NATS_URL)",
    "AUTH_REQUIRED=$($env:AUTH_REQUIRED)",
    "NODE_ENV=development",
    "ANTHROPIC_API_KEY=$($env:ANTHROPIC_API_KEY)",
    "OPENAI_API_KEY=$($env:OPENAI_API_KEY)",
    "GEMINI_API_KEY=$($env:GEMINI_API_KEY)",
    "ALERTS_ENABLED=$($env:ALERTS_ENABLED)",
    "JWT_SECRET=$($env:JWT_SECRET)",
    "JWT_EXPIRY=$($env:JWT_EXPIRY)",
    "CORS_ORIGIN=$($env:CORS_ORIGIN)",
    "INGESTION_URL=http://localhost:8080",
    "HOST=0.0.0.0"
)

$envSetCommands = ($envVars | ForEach-Object {
    $parts = $_ -split "=", 2
    "`$env:$($parts[0])='$($parts[1])'"
}) -join "; "

$services = @(
    @{ Name = "Ingestion"; Script = "dev:ingestion"; Port = 8080 },
    @{ Name = "API";       Script = "dev:api";       Port = 8081 },
    @{ Name = "Replay";    Script = "dev:replay";    Port = 8082 },
    @{ Name = "Proxy";     Script = "dev:proxy";     Port = 8090 }
)

foreach ($svc in $services) {
    Write-Host "  Starting $($svc.Name) service (port $($svc.Port))..." -ForegroundColor Gray
    
    $cmd = "$envSetCommands; Set-Location '$ProjectRoot'; bun run $($svc.Script)"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "& { `$Host.UI.RawUI.WindowTitle = 'Refract - $($svc.Name)'; $cmd }"
}

Write-Host "  ✅ All microservices launched" -ForegroundColor Green

# ─────────────────────────────────────────────────────────────────────
# Step 6: Start Dashboard UI
# ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[6/6] Starting Dashboard UI..." -ForegroundColor Yellow

$dashboardEnv = @(
    "`$env:NEXT_PUBLIC_API_URL='http://localhost:8081'",
    "`$env:NEXT_PUBLIC_INGESTION_URL='http://localhost:8080'",
    "`$env:NEXT_PUBLIC_REPLAY_URL='http://localhost:8082'",
    "`$env:NEXT_PUBLIC_PROXY_URL='http://localhost:8090'",
    "`$env:NEXT_PUBLIC_AUTH_REQUIRED='false'"
) -join "; "

$dashCmd = "$dashboardEnv; Set-Location '$(Join-Path $ProjectRoot 'apps/dashboard')'; bun run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "& { `$Host.UI.RawUI.WindowTitle = 'Refract - Dashboard'; $dashCmd }"

Write-Host "  ✅ Dashboard launched" -ForegroundColor Green

# ─────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  All Services Started!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Infrastructure:" -ForegroundColor White
Write-Host "    PostgreSQL:  localhost:5433" -ForegroundColor Gray
Write-Host "    NATS:        localhost:4222 (monitor: localhost:8222)" -ForegroundColor Gray
Write-Host "    Redis:       localhost:6379" -ForegroundColor Gray
Write-Host ""
Write-Host "  Microservices:" -ForegroundColor White
Write-Host "    Ingestion:   http://localhost:8080" -ForegroundColor Gray
Write-Host "    API:         http://localhost:8081" -ForegroundColor Gray
Write-Host "    Replay:      http://localhost:8082" -ForegroundColor Gray
Write-Host "    Proxy:       http://localhost:8090" -ForegroundColor Gray
Write-Host ""
Write-Host "  Web UI:" -ForegroundColor White
Write-Host "    Dashboard:   http://localhost:3000" -ForegroundColor Gray
Write-Host "    Demo Chat:   http://localhost:8090/demo" -ForegroundColor Gray
Write-Host ""
Write-Host "  To stop everything:" -ForegroundColor DarkYellow
Write-Host "    Close the PowerShell windows and run:" -ForegroundColor DarkYellow
Write-Host "    docker compose -f infra/docker/docker-compose.yml down" -ForegroundColor DarkYellow
Write-Host ""
