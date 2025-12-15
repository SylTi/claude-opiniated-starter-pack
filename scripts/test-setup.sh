#!/bin/bash

# Script de setup pour les tests
# Usage: ./scripts/test-setup.sh

set -e

echo "🚀 Setup environnement de test..."
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Vérifier que Docker est installé
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker n'est pas installé${NC}"
    echo "Installez Docker : https://docs.docker.com/get-docker/"
    exit 1
fi

# Vérifier que Docker est démarré
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker n'est pas démarré${NC}"
    echo "Démarrez Docker et réessayez"
    exit 1
fi

echo -e "${GREEN}✓${NC} Docker est installé et démarré"

# Démarrer PostgreSQL de test
echo ""
echo "📦 Démarrage de PostgreSQL de test..."
docker-compose up -d postgres-test

# Attendre que PostgreSQL soit prêt
echo "⏳ Attente que PostgreSQL soit prêt..."
sleep 5

# Vérifier le healthcheck
RETRY=0
MAX_RETRY=30

while [ $RETRY -lt $MAX_RETRY ]; do
    if docker exec saas-postgres-test pg_isready -U postgres &> /dev/null; then
        echo -e "${GREEN}✓${NC} PostgreSQL est prêt"
        break
    fi
    RETRY=$((RETRY+1))
    if [ $RETRY -eq $MAX_RETRY ]; then
        echo -e "${RED}❌ PostgreSQL n'est pas prêt après 30 secondes${NC}"
        echo "Vérifiez les logs : docker-compose logs postgres-test"
        exit 1
    fi
    sleep 1
done

# Exécuter les migrations
echo ""
echo "🔄 Exécution des migrations de test..."
cd apps/api
NODE_ENV=test node ace migration:run

echo ""
echo -e "${GREEN}✅ Setup terminé !${NC}"
echo ""
echo "Vous pouvez maintenant exécuter les tests :"
echo -e "${YELLOW}  npm test${NC}"
echo -e "${YELLOW}  npm run api:test${NC}"
echo ""
echo "Pour arrêter PostgreSQL :"
echo -e "${YELLOW}  docker-compose down postgres-test${NC}"
echo ""
