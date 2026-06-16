$root = "d:\Uni Stuff\Internships\AiGENThix\Refract"
$extensions = @("*.ts","*.tsx","*.json","*.yml","*.md","*.css","*.toml","*.mjs","*.env*")

$replacements = @(
    @("@uselumina/sdk",   "@refract/sdk"),
    @("@uselumina",       "@refract"),
    @("@lumina/dashboard", "@refract/dashboard"),
    @("@lumina/schema",   "@refract/schema"),
    @("@lumina/core",     "@refract/core"),
    @("@lumina/config",   "@refract/config"),
    @("@lumina/database", "@refract/database"),
    @("lumina-ingestion", "refract-ingestion"),
    @("lumina-api",       "refract-api"),
    @("lumina-replay",    "refract-replay"),
    @("lumina-dashboard", "refract-dashboard"),
    @("lumina-postgres",  "refract-postgres"),
    @("lumina-nats",      "refract-nats"),
    @("lumina-redis",     "refract-redis"),
    @("lumina-traces",    "refract-traces"),
    @("lumina-ingestion-consumer", "refract-ingestion-consumer"),
    @("lumina-ui-theme",  "refract-ui-theme"),
    @("LUMINA_API_KEY",   "REFRACT_API_KEY"),
    @("LUMINA_ENDPOINT",  "REFRACT_ENDPOINT"),
    @("LUMINA_ENVIRONMENT","REFRACT_ENVIRONMENT"),
    @("LUMINA_BATCH_SIZE","REFRACT_BATCH_SIZE"),
    @("LUMINA_BATCH_INTERVAL_MS","REFRACT_BATCH_INTERVAL_MS"),
    @("LUMINA_MAX_RETRIES","REFRACT_MAX_RETRIES"),
    @("LUMINA_TIMEOUT_MS","REFRACT_TIMEOUT_MS"),
    @("LUMINA_ENABLED",   "REFRACT_ENABLED"),
    @("lumina_live_",     "refract_live_"),
    @("Lumina Dashboard", "Refract Dashboard"),
    @("Lumina Query API", "Refract Query API"),
    @("Lumina Ingestion Service", "Refract Ingestion Service"),
    @("Lumina Ingestion", "Refract Ingestion"),
    @("Lumina Replay",    "Refract Replay"),
    @("Lumina Database Schema", "Refract Database Schema"),
    @("Lumina Database",  "Refract Database"),
    @("Lumina SDK",       "Refract SDK"),
    @("Lumina Team",      "Refract Team"),
    @("Lumina Self-Hosted", "Refract Self-Hosted"),
    @("Lumina Environment", "Refract Environment"),
    @("use-lumina/Lumina","aigenthix/Refract"),
    @("uselumina.io",    "refract.dev"),
    @("initLumina",       "initRefract"),
    @("init_lumina",      "init_refract"),
    @("""lumina""",       """refract"""),
    @("'lumina'",         "'refract'")
)

$files = Get-ChildItem -Path $root -Recurse -Include $extensions -File |
    Where-Object { $_.FullName -notmatch "(node_modules|\.git[\\/]|bun\.lock|\.next|rename-to-refract)" }

$count = 0
foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName)
    if ($content -match "lumina|Lumina|LUMINA|uselumina") {
        $newContent = $content
        foreach ($pair in $replacements) {
            $newContent = $newContent.Replace($pair[0], $pair[1])
        }
        # Catch remaining case-sensitive occurrences
        $newContent = $newContent -replace "Lumina", "Refract"
        
        if ($newContent -ne $content) {
            [System.IO.File]::WriteAllText($file.FullName, $newContent, [System.Text.UTF8Encoding]::new($false))
            $count++
            Write-Output "Updated: $($file.FullName)"
        }
    }
}
Write-Output "`nTotal files updated: $count"
