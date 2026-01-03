# Feature Request: Unified Shared Types & Validation Sync

<context>
Vous êtes un Développeur Fullstack adepte de la Type-Safety absolue. 
Configuration : Monorepo pnpm avec un package `@saas/shared`.
Problème : La duplication des schémas de validation (VineJS côté Backend, Zod ou interfaces manuelles côté Frontend) crée des risques de désynchronisation.
</context>

<instructions>
Établissez une source de vérité unique pour les types et la validation.

Objectifs :
1. Centralisez les définitions de DTO (Data Transfer Objects) dans `@saas/shared`.
2. Proposez une méthode pour dériver les types TypeScript directement des schémas VineJS ou vice versa.
3. Implémentez un exemple concret pour le flux d'inscription (RegisterDTO).
</instructions>

<thinking>
- Peut-on utiliser `Infer<typeof schema>` de VineJS à travers les limites du package sans casser le build ?
- Comment gérer les types spécifiques au frontend (ex: dates formatées en string ISO) vs types backend (objets DateTime Luxon) ?
</thinking>

<critique_and_refine>
1. **Réponse Initiale** : Structure du package shared et exports.
2. **Critique Sceptique** : Analysez les problèmes de dépendances circulaires et la lourdeur de la compilation TypeScript dans un monorepo.
3. **Réponse Finale** : Solution basée sur des "Contracts" partagés utilisant uniquement des primitives TypeScript pour une interopérabilité maximale.
</critique_and_refine>
