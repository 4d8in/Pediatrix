# Sauvegarde complète de Pédiatrix (Windows / PowerShell) dans backups\<date>\ :
#   - base PostgreSQL « clinique » (ressources FHIR de HAPI), format pg_dump custom ;
#   - apps\backend\data\ (comptes et hash des mots de passe, résultats lus).
# Le dump est écrit dans le conteneur puis copié avec `docker compose cp` : une
# redirection `>` de PowerShell corromprait ce fichier binaire.
# Usage (depuis la racine du projet) : powershell -ExecutionPolicy Bypass -File scripts\backup-db.ps1
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$stamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$dest = Join-Path "backups" $stamp
New-Item -ItemType Directory -Force -Path $dest | Out-Null

Write-Host "Sauvegarde de la base clinique..."
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/clinique.dump'
if ($LASTEXITCODE -ne 0) { throw "pg_dump a échoué." }
docker compose cp postgres:/tmp/clinique.dump (Join-Path $dest "clinique.dump")
if ($LASTEXITCODE -ne 0) { throw "La copie du dump a échoué." }
docker compose exec -T postgres rm -f /tmp/clinique.dump | Out-Null

if (Test-Path "apps\backend\data") {
  Write-Host "Sauvegarde de apps\backend\data..."
  Copy-Item -Recurse "apps\backend\data" (Join-Path $dest "backend-data")
}

Write-Host "OK : sauvegarde dans $dest"
