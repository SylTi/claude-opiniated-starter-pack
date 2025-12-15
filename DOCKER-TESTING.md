# Docker pour les Tests

## Vue d'ensemble

Ce projet utilise Docker **uniquement pour les tests d'intégration**.

```
┌─────────────────────────────────────────────┐
│         ENVIRONNEMENTS BASE DE DONNÉES      │
├─────────────────────────────────────────────┤
│ Tests Unitaires    → DB Mockée (aucune DB) │
│ Tests Intégration  → Docker PostgreSQL      │
│ Développement      → Supabase Cloud OU      │
│                      Docker PostgreSQL      │
│ Production         → Supabase Cloud         │
└─────────────────────────────────────────────┘
```

## ⚠️ RÈGLE IMPORTANTE

**Les tests ne doivent JAMAIS se connecter à Supabase cloud**

## Services Docker

### postgres-test (Port 5433)

Base de données **uniquement pour les tests d'intégration**.

```bash
# Démarrer
docker-compose up -d postgres-test

# Vérifier le statut
docker-compose ps postgres-test

# Voir les logs
docker-compose logs -f postgres-test

# Arrêter
docker-compose down postgres-test

# Arrêter et supprimer les données
docker-compose down -v postgres-test
```

**Configuration:**
- Image: postgres:15-alpine
- Port: 5433 (pour éviter conflit avec PostgreSQL local)
- Database: saas_test
- User: postgres
- Password: postgres

### postgres-dev (Port 5432) - Optionnel

Base de données locale pour le développement (alternative à Supabase).

```bash
# Démarrer
docker-compose up -d postgres-dev

# Arrêter
docker-compose down postgres-dev
```

## Workflow de Test

### 1. Démarrer PostgreSQL de test

```bash
docker-compose up -d postgres-test
```

### 2. Attendre que PostgreSQL soit prêt

```bash
# Le healthcheck vérifie automatiquement
docker-compose ps postgres-test

# Devrait afficher "healthy"
```

### 3. Exécuter les migrations

```bash
cd apps/api
NODE_ENV=test node ace migration:run
```

### 4. Lancer les tests

```bash
# Tous les tests
npm test

# Tests d'intégration uniquement
npm run api:test functional

# Tests unitaires uniquement (pas de DB)
npm run api:test unit
```

### 5. Nettoyage (optionnel)

```bash
# Arrêter le container
docker-compose down postgres-test

# Supprimer aussi les données
docker-compose down -v
```

## Commandes Rapides

```bash
# Tout démarrer (test + dev)
docker-compose up -d

# Voir tous les containers
docker-compose ps

# Voir les logs de tous les services
docker-compose logs -f

# Redémarrer un service
docker-compose restart postgres-test

# Arrêter tout
docker-compose down

# Reset complet (⚠️ supprime les données)
docker-compose down -v
docker-compose up -d
```

## Connexion Manuelle à la DB de Test

### Via psql dans le container

```bash
docker exec -it saas-postgres-test psql -U postgres -d saas_test
```

### Via psql local

```bash
psql -h localhost -p 5433 -U postgres -d saas_test
```

### Via un client GUI

- **Host**: localhost
- **Port**: 5433
- **Database**: saas_test
- **User**: postgres
- **Password**: postgres

## Dépannage

### Le container ne démarre pas

```bash
# Vérifier les logs
docker-compose logs postgres-test

# Vérifier que le port 5433 est libre
netstat -an | grep 5433
lsof -i :5433

# Recréer le container
docker-compose down postgres-test
docker-compose up -d postgres-test
```

### Les tests échouent avec "connection refused"

```bash
# Vérifier que le container tourne
docker-compose ps postgres-test

# Vérifier le healthcheck
docker inspect saas-postgres-test | grep -A 10 Health

# Attendre quelques secondes que PostgreSQL soit prêt
sleep 5
npm test
```

### Les migrations échouent

```bash
# Vérifier la connexion
docker exec -it saas-postgres-test psql -U postgres -d saas_test -c "SELECT 1;"

# Reset complet de la DB
docker-compose down -v postgres-test
docker-compose up -d postgres-test
sleep 5
NODE_ENV=test node ace migration:run
```

### "Database already exists"

```bash
# Normal - PostgreSQL garde les données entre redémarrages
# Pour reset complet :
docker-compose down -v postgres-test
docker-compose up -d postgres-test
```

## Variables d'Environnement

### .env.test (apps/api)

```env
DB_HOST=localhost
DB_PORT=5433
DB_USER=postgres
DB_PASSWORD=postgres
DB_DATABASE=saas_test
```

### .env (apps/api) - Développement

```env
# Supabase cloud OU docker postgres-dev
DB_HOST=your-project.supabase.co  # ou localhost pour docker
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your-password
DB_DATABASE=postgres  # ou saas_dev pour docker
```

## CI/CD

Le fichier `docker-compose.yml` est également utilisé dans la CI/CD (GitHub Actions) pour exécuter les tests.

Voir la documentation pour l'exemple de workflow.

## Volumes Docker

Les données sont persistées dans des volumes Docker :

```bash
# Lister les volumes
docker volume ls | grep saas

# Supprimer les volumes (⚠️ perte de données)
docker volume rm saas_postgres_test_data
docker volume rm saas_postgres_dev_data
```

## Résumé

| Service | Port | Utilisation | Données Persistées |
|---------|------|-------------|-------------------|
| postgres-test | 5433 | Tests d'intégration | Oui (volume) |
| postgres-dev | 5432 | Dev local (optionnel) | Oui (volume) |
| Supabase cloud | 5432 | Dev/Prod (recommandé) | Oui (cloud) |

**Rappel** : Les tests ne doivent JAMAIS utiliser Supabase cloud, uniquement Docker PostgreSQL local.
