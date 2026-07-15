# Pédiatrix — Infrastructure de données locale

Étape 1 : socle Docker (HAPI FHIR + PostgreSQL), sans code applicatif.

## Prérequis

- Docker et Docker Compose v2 (`docker compose version`)
- `curl` et `jq` (pour le script de vérification)
- Fonctionne entièrement hors ligne une fois les images téléchargées

## Démarrer

```bash
cp .env.example .env   # si .env n'existe pas encore
docker compose up -d
```

## Vérifier

```bash
./scripts/verify-fhir.sh
```

Le script attend que HAPI FHIR soit prêt, crée un patient fictif de test, le relit,
puis vérifie qu'il est bien persisté dans PostgreSQL. Il affiche un succès ou un
échec clair à chaque étape.

## Arrêter

```bash
docker compose down       # arrête les conteneurs, garde les données
docker compose down -v    # arrête et supprime aussi le volume PostgreSQL
```
