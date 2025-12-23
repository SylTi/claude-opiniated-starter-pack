# Implémentation du Système d'Authentification et Autorisation Complet

## Objectif
Implémenter un système d'authentification et d'autorisation complet avec les fonctionnalités suivantes :

### 1. Authentification de Base (Déjà partiellement présente)
- Authentification email/mot de passe
- Gestion des sessions
- Middleware d'authentification

### 2. Fonctionnalités à Ajouter

#### A. Authentification Multi-Facteurs (MFA)
- Implémentation TOTP (Time-based One-Time Password)
- Intégration avec Google Authenticator, Authy, etc.
- Génération de QR codes pour la configuration
- Vérification des tokens MFA
- Option pour activer/désactiver MFA

#### B. OAuth 2.0 / OpenID Connect
- Authentification via Google
- Authentification via GitHub
- Authentification via Microsoft
- Architecture extensible pour ajouter d'autres fournisseurs

#### C. RBAC (Role-Based Access Control)
- Système de rôles (Admin, User, Guest, etc.)
- Permissions fines par rôle
- Middleware de vérification des permissions
- Interface d'administration pour gérer les rôles

#### D. Gestion des Utilisateurs
- Inscription avec validation d'email
- Récupération de mot de passe
- Profil utilisateur avec photo
- Historique des connexions

### 3. Interface Utilisateur

#### Pages à Créer
- Page de connexion (`/login`)
- Page d'inscription (`/register`)
- Page de récupération de mot de passe (`/forgot-password`)
- Page de réinitialisation de mot de passe (`/reset-password`)
- Page de profil utilisateur (`/profile`)
- Page de configuration MFA (`/profile/mfa`)

#### Composants à Créer
- Formulaire de connexion
- Formulaire d'inscription
- Formulaire de récupération de mot de passe
- Composant de configuration MFA avec QR code
- Menu utilisateur en haut à droite (avec avatar, nom, et options)

#### Intégration avec l'Interface Existante
- Ajouter un bouton "Se connecter" en haut à droite de la page principale
- Le bouton doit être visible sur toutes les pages
- Après connexion, afficher un menu dropdown avec :
  - Profil
  - Paramètres
  - Déconnexion

### 4. Sécurité
- Toujours utiliser HTTPS en production
- Protection CSRF sur tous les formulaires
- Rate limiting sur les endpoints d'authentification
- Validation stricte des entrées
- Hachage sécurisé des mots de passe (déjà implémenté)
- Tokens sécurisés pour la réinitialisation de mot de passe

### 5. API Backend
- Endpoints RESTful pour l'authentification
- Validation des données avec Vine.js
- Documentation des endpoints
- Gestion des erreurs appropriée

### 6. Intégration Frontend-Backend
- Appels API depuis le frontend
- Gestion des états de chargement
- Gestion des erreurs avec affichage approprié
- Redirection après actions (connexion, déconnexion, etc.)

### 7. Tests
- Tests unitaires pour les services d'authentification
- Tests d'intégration pour les endpoints API
- Tests frontend pour les composants et pages

## Technologies à Utiliser

### Backend (AdonisJS)
- `@adonisjs/auth` (déjà présent)
- `@adonisjs/ally` pour OAuth
- `@adonisjs/bouncer` pour RBAC
- `otplib` pour MFA
- `qrcode` pour la génération de QR codes

### Frontend (Next.js)
- shadcn/ui pour les composants
- react-hook-form pour la gestion des formulaires
- zod pour la validation
- lucide-react pour les icônes
- next/navigation pour la gestion des routes

## Instructions Spécifiques

1. **Backend d'abord** : Commencez par implémenter les endpoints API et la logique backend
2. **Frontend ensuite** : Créez les pages et composants frontend après que le backend soit fonctionnel
3. **Tests en parallèle** : Écrivez les tests au fur et à mesure de l'implémentation
4. **Documentation** : Documentez chaque endpoint API et composant complexe
5. **Sécurité** : Appliquez les bonnes pratiques de sécurité à chaque étape

## Livrables Attendus

1. Code backend complet avec tous les endpoints fonctionnels
2. Code frontend complet avec toutes les pages et composants
3. Tests unitaires et d'intégration
4. Documentation des endpoints API
5. Mise à jour du README avec les instructions d'utilisation

## Critères d'Acceptation

1. Un utilisateur peut s'inscrire avec validation d'email
2. Un utilisateur peut se connecter avec email/mot de passe
3. Un utilisateur peut se connecter via OAuth (Google, GitHub)
4. Un utilisateur peut activer/désactiver MFA
5. Un utilisateur peut récupérer son mot de passe
6. Les rôles et permissions sont correctement appliqués
7. Toutes les pages sont accessibles et fonctionnelles
8. Le bouton de connexion est visible sur toutes les pages
9. Le menu utilisateur s'affiche après connexion
10. Tous les tests passent

## Notes Additionnelles

- Utilisez les conventions de codage existantes dans le projet
- Maintenez la cohérence des types TypeScript entre frontend et backend
- Utilisez le package `@saas/shared` pour les types partagés
- Assurez-vous que toutes les dépendances sont à jour
- Optimisez les performances des requêtes API
- Implémentez un système de logging approprié
