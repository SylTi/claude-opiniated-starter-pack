Tu es un senior fullstack engineer TypeScript.
Tu dois initialiser un projet SaaS avec une architecture claire, opinionnée et maintenable.

Contraintes absolues :
- TypeScript partout
- Open-source uniquement
- Code lisible, structuré, prêt pour long terme
- Approche “convention over configuration”
- Génération pensée pour itérations rapides avec IA (vibe coding)

STACK TECHNIQUE (ne pas dévier) :
- Frontend : Next.js (App Router, TypeScript)
- UI : Tailwind CSS + shadcn/ui
- Backend : AdonisJS (TypeScript)
- Base de données : Supabase (PostgreSQL uniquement, pas d’auth Supabase)
- ORM : celui fourni par AdonisJS
- Auth : backend AdonisJS (classique, extensible)
- Monorepo avec gestion claire des responsabilités

---

## STRUCTURE DE REPO ATTENDUE

Le projet doit être un monorepo avec cette structure exacte :

/apps
  /web            → Frontend Next.js
  /api            → Backend AdonisJS

/packages
  /shared         → Types partagés (DTO, enums, contrats API)
  /config         → Config partagée (eslint, tsconfig, tailwind preset)

/infra
  /supabase       → SQL, migrations, policies (lecture seule pour le backend)

/docs
  architecture.md
  conventions.md

---

## FRONTEND (apps/web)

- Next.js App Router
- Tailwind configuré proprement
- shadcn/ui installé et fonctionnel
- Layout de base (app/layout.tsx)
- Exemple de page dashboard
- Exemple de composant shadcn (Button, Card)
- Aucun appel API mocké
- Préparé pour consommer une API REST JSON

---

## BACKEND (apps/api)

- AdonisJS initialisé en TypeScript
- Structure MVC standard Adonis
- Connexion PostgreSQL via Supabase
- Exemple :
  - User model
  - Migration users
  - Controller REST (index, show)
  - Route groupée /api/v1
- Validation avec validator Adonis
- Auth basique fonctionnelle, mais rien d'avancée pour l’instant

---

## SHARED PACKAGE (packages/shared)

- Types TypeScript stricts
- Exemple :
  - UserDTO
  - ApiResponse<T>
- Importable depuis web et api
- Aucun code runtime, types only

---

## REGLES DE CODAGE

- Toujours utiliser async/await
- Pas de any
- Typage explicite des retours
- Commentaires uniquement quand utiles
- Pas de logique métier dans le frontend
- Le backend est la source de vérité

---

## LIVRABLE ATTENDU

1. Arborescence complète du repo
2. Commandes pour initialiser chaque app
3. Fichiers clés générés (extraits quand utile)
4. Explication courte de chaque dossier
5. Aucun fluff, aucun tutoriel inutile

Commence par proposer la structure complète du monorepo, puis initialise chaque partie étape par étape.
