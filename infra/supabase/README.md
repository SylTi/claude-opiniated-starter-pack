# Supabase Infrastructure

Ce dossier contient les migrations SQL et la configuration Supabase pour le projet.

## Structure

- `migrations/` : Fichiers SQL de migration ordonnés chronologiquement
- `seed.sql` : Données de départ pour le développement

## Configuration de la connexion

Le backend AdonisJS se connecte directement à PostgreSQL via Supabase.

Variables d'environnement nécessaires dans `apps/api/.env`:

```env
DB_HOST=<votre-projet>.supabase.co
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=<votre-mot-de-passe>
DB_DATABASE=postgres
```

## Exécuter les migrations

Les migrations doivent être exécutées via:
- Supabase CLI : `supabase db push`
- Manuellement via le SQL Editor de Supabase
- Via AdonisJS Lucid (si besoin de synchroniser)
