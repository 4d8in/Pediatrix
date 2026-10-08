# Restaure une sauvegarde créée par backup-db.ps1 (Windows / PowerShell).
# Usage (depuis la racine du projet) :
#   powershell -ExecutionPolicy Bypass -File scripts\restore-db.ps1 backups\<date>
# ATTENTION : remplace toutes les données actuelles (base clinique et comptes).
param([Parameter(Mandatory = $true)][string]$Source)
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$dump = Join-Path $Source "clinique.dump"
if (-not (Test-Path $dump)) { throw "Fichier introuvable : $dump" }

$answer = Read-Host "Remplacer TOUTES les données actuelles par $Source ? Tapez OUI"
if ($answer -ne "OUI") { Write-Host "Annulé."; exit 1 }

Write-Host "Arrêt de HAPI..."
docker compose stop hapi-fhir

Write-Host "Restauration de la base clinique..."
docker compose cp $dump postgres:/tmp/restore.dump
if ($LASTEXITCODE -ne 0) { throw "La copie du dump vers le conteneur a échoué." }
docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner /tmp/restore.dump'
if ($LASTEXITCODE -ne 0) { throw "pg_restore a échoué (HAPI reste arrêté : corriger puis relancer 'docker compose start hapi-fhir')." }
docker compose exec -T postgres rm -f /tmp/restore.dump | Out-Null

$data = Join-Path $Source "backend-data"
if (Test-Path $data) {
  Write-Host "Restauration de apps\backend\data..."
  if (Test-Path "apps\backend\data") { Remove-Item -Recurse -Force "apps\backend\data" }
  Copy-Item -Recurse $data "apps\backend\data"
}

Write-Host "Redémarrage de HAPI..."
docker compose start hapi-fhir
Write-Host "OK : restauration terminée. Attendre que HAPI soit « healthy » (docker compose ps)."
