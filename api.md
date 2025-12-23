# API Endpoints (v1)

Toutes les routes sont préfixées par `/api/v1`.

### Routes Publiques

#### Racine
*   `GET /` - Route de bienvenue.

#### Authentification (Auth)
*   `POST /auth/register` - Inscription d'un nouvel utilisateur.
*   `POST /auth/login` - Connexion d'un utilisateur.
*   `POST /auth/forgot-password` - Envoi d'un lien de réinitialisation de mot de passe.
*   `POST /auth/reset-password` - Réinitialisation du mot de passe avec un token.
*   `GET /auth/verify-email/:token` - Vérification de l'email avec un token.

#### OAuth (Authentification Sociale)
*   `GET /auth/oauth/:provider/redirect` - Redirection vers le fournisseur OAuth.
*   `GET /auth/oauth/:provider/callback` - Callback après authentification OAuth.

#### Invitations d'équipe
*   `GET /invitations/:token` - Récupérer les détails d'une invitation par token.

---

### Routes Protégées (Nécessitent une authentification)

#### Utilisateurs (Users)
*   `GET /users` - Lister les utilisateurs.
*   `GET /users/:id` - Afficher un utilisateur spécifique.

#### Authentification (Auth)
*   `POST /auth/logout` - Déconnexion de l'utilisateur.
*   `GET /auth/me` - Obtenir les informations de l'utilisateur connecté.
*   `PUT /auth/profile` - Mettre à jour le profil de l'utilisateur.
*   `PUT /auth/password` - Changer le mot de passe de l'utilisateur.
*   `POST /auth/resend-verification` - Renvoyer l'email de vérification.
*   `GET /auth/login-history` - Obtenir l'historique de connexion de l'utilisateur.

#### Authentification Multi-Facteurs (MFA)
*   `POST /auth/mfa/setup` - Configurer la MFA.
*   `POST /auth/mfa/enable` - Activer la MFA.
*   `POST /auth/mfa/disable` - Désactiver la MFA.
*   `GET /auth/mfa/status` - Obtenir le statut de la MFA.
*   `POST /auth/mfa/regenerate-backup-codes` - Régénérer les codes de secours.

#### OAuth (Liaison de comptes)
*   `GET /auth/oauth/accounts` - Lister les comptes OAuth liés.
*   `GET /auth/oauth/:provider/link` - Lier un compte OAuth.
*   `GET /auth/oauth/:provider/link/callback` - Callback pour la liaison de compte.
*   `DELETE /auth/oauth/:provider/unlink` - Dissocier un compte OAuth.

#### Dashboard
*   `GET /dashboard/stats` - Obtenir les statistiques de l'utilisateur.

#### Équipes (Teams)
*   `GET /teams` - Lister les équipes de l'utilisateur.
*   `POST /teams` - Créer une nouvelle équipe.
*   `GET /teams/:id` - Afficher une équipe spécifique.
*   `PUT /teams/:id` - Mettre à jour une équipe.
*   `POST /teams/:id/switch` - Changer d'équipe active.
*   `POST /teams/:id/members` - Ajouter un membre à une équipe.
*   `DELETE /teams/:id/members/:userId` - Retirer un membre d'une équipe.
*   `POST /teams/:id/leave` - Quitter une équipe.
*   `DELETE /teams/:id` - Supprimer une équipe.
*   `POST /teams/:id/invitations` - Envoyer une invitation à rejoindre l'équipe.
*   `GET /teams/:id/invitations` - Lister les invitations en attente pour une équipe.
*   `DELETE /teams/:id/invitations/:invitationId` - Annuler une invitation.

#### Invitations d'équipe (Actions)
*   `POST /invitations/:token/accept` - Accepter une invitation.
*   `POST /invitations/:token/decline` - Refuser une invitation.

---

### Routes Administrateur (Nécessitent les droits d'administrateur)

*   `GET /admin/stats` - Obtenir des statistiques globales.
*   `GET /admin/users` - Lister tous les utilisateurs.
*   `POST /admin/users/:id/verify-email` - Forcer la vérification de l'email d'un utilisateur.
*   `POST /admin/users/:id/unverify-email` - Invalider l'email d'un utilisateur.
*   `PUT /admin/users/:id/tier` - Mettre à jour le niveau d'abonnement d'un utilisateur.
*   `DELETE /admin/users/:id` - Supprimer un utilisateur.
*   `GET /admin/teams` - Lister toutes les équipes.
*   `PUT /admin/teams/:id/tier` - Mettre à jour le niveau d'abonnement d'une équipe.
