### **Prompt pour Claude Code**

**Persona :** Tu es un développeur full-stack senior, expert en architecture logicielle et spécialiste des systèmes de paiement résilients pour des applications SaaS. Tu portes une attention particulière à la robustesse, à la scalabilité, à la sécurité et à l'expérience utilisateur, en anticipant les problèmes du monde réel.

**Contexte Impératif :** Le projet possède déjà une structure de modèles pour la gestion des abonnements : `User`, `Team`, `Subscription`, et `SubscriptionTier`. Ton travail doit s'intégrer **parfaitement** à cette structure existante.

**Objectif Général :**
Intégrer un système de paiement complet, résilient et scalable, en s'appuyant sur la structure d'abonnement existante et en respectant des principes de sécurité stricts. Le système doit utiliser une couche d'abstraction pour être agnostique au fournisseur de paiement. L'implémentation initiale ciblera Stripe.

---

### **Partie 1 : Abstraction du Fournisseur de Paiement**

*Cette partie reste conceptuellement la même, mais nous ajoutons un point sur la gestion des clés.*

1.  **Interface `PaymentProvider`** (`apps/api/app/services/types/payment_provider.ts`):
    *   `createCheckoutSession(...)`
    *   `createCustomerPortalSession(...)`
    *   `handleWebhook(...)`
2.  **Service `PaymentService`** (`apps/api/app/services/`).
3.  **Implémentation `StripeProvider`** (`apps/api/app/services/providers/`).
4.  **Sécurité des Clés d'API :**
    *   Toutes les clés secrètes des fournisseurs (ex: `STRIPE_SECRET_KEY`) doivent être stockées de manière sécurisée via des variables d'environnement et ne jamais être exposées côté client ou versionnées.

---

### **Partie 2 : Backend (AdonisJS) - Architecture de Paiement Finalisée et Robuste**

Cette architecture est revue pour adresser des failles critiques liées à l'identification du client et à la flexibilité de la facturation.

#### **2.1. Sécurité des Endpoints et Identification du Client**
*   Les routes qui initient des actions de paiement (`POST /checkout-sessions`, etc.) **doivent** être protégées par le middleware `auth` et des politiques Bouncer.
*   **Identification Fiable :** Lors de la création d'une session de paiement, le backend **doit** passer un identifiant interne immuable au fournisseur de paiement. Ceci crée une boucle de confiance fermée.
    ```typescript
    // Exemple lors de la création d'une session Stripe
    const session = await stripe.checkout.sessions.create({
      // ... autres paramètres
      // L'ID est préfixé pour gérer la polymorphie (User vs Team)
      client_reference_id: `${entityType}_${entity.id}` // ex: 'user_123' ou 'team_456'
    });
    ```

#### **2.2. Schéma de la Base de Données (Architecture Robuste)**

Cette nouvelle structure modélise correctement la relation entre les entités de l'application et les objets du fournisseur de paiement, y compris pour les équipes et la gestion des taxes.

1.  **Nouvelle Table `payment_customers` (Polymorphique)**
    *   Découple les entités de l'application du "Client" du fournisseur. Une `User` ou une `Team` peut être un client.
    *   Colonnes : `id`, `subscriber_type` (string: 'user' ou 'team'), `subscriber_id` (integer), `provider` (string), `provider_customer_id` (string, unique).

2.  **Nouvelle Table `products`**
    *   Fait le lien entre nos `SubscriptionTier` et leur représentation en tant que "Produit" chez un fournisseur.
    *   Colonnes : `id`, `tier_id` (fk), `provider` (string), `provider_product_id` (string, unique).

3.  **Nouvelle Table `prices` (Avec Gestion des Taxes)**
    *   Représente les différentes tarifications d'un `Product`.
    *   Colonnes : `id`, `product_id` (fk), `provider` (string), `provider_price_id` (string, unique), `interval` (enum: 'month', 'year'), `currency` (string), `unit_amount` (integer), `tax_behavior` (enum: 'inclusive', 'exclusive', default 'exclusive').

4.  **Table `subscriptions` (Modification)**
    *   Colonnes à ajouter : `provider_name` (string, nullable) et `provider_subscription_id` (string, nullable, indexé, unique).

#### **2.3. Modèles AdonisJS**

*   Crée les modèles `PaymentCustomer`, `Product`, et `Price`.
*   Mets à jour le modèle `Subscription` avec les nouveaux champs.
*   Établis les relations ORM (`hasMany`, `belongsTo`, `morphTo`).

#### **2.4. Gestion des Webhooks : Sécurité Maximale**

1.  **Vérification de la Signature (Étape 1 et Impérative) :**
    *   Rejette immédiatement toute requête dont la signature est invalide avec un statut `400`.

2.  **Idempotence :**
    *   Vérifie l'ID de l'événement pour éviter les doubles traitements.

3.  **Transactions Atomiques :**
    *   Enveloppe toute la logique dans une transaction de base de données.

4.  **Logique de Traitement Sécurisée (Exemple pour `checkout.session.completed`) :**
    *   **N'utilise jamais l'email du payload.** L'identification se fait **uniquement** via le `client_reference_id`.
    ```typescript
    // Pseudocode pour le webhook handler
    async handleCheckoutCompleted(payload, signature) {
      // 1. Vérifier la signature (impératif)
      // ...

      const eventId = payload.id;
      if (await this.eventProcessor.hasBeenProcessed(eventId)) {
        return; // 2. Idempotence
      }

      // IDENTIFICATION FIABLE
      const clientReferenceId = payload.client_reference_id;
      if (!clientReferenceId) {
        throw new Error('Critical: client_reference_id manquant dans le webhook.');
      }
      const [subscriberType, subscriberId] = clientReferenceId.split('_');

      // 3. Transaction Atomique
      await Database.transaction(async (trx) => {
        // Crée ou récupère notre enregistrement client local
        await PaymentCustomer.updateOrCreate({
          subscriberType,
          subscriberId,
          provider: 'stripe',
        }, {
          provider_customer_id: payload.customer,
        }, { client: trx });
        
        const price = await Price.findByOrFail('provider_price_id', payload.lines.data[0].price.id);

        await Subscription.query({ client: trx })
          .where('subscriberType', subscriberType)
          .where('subscriberId', subscriberId)
          .update({ status: 'cancelled' });

        await Subscription.create({
          subscriberType,
          subscriberId,
          tierId: price.product.tierId, // via relation
          status: 'active',
          provider_name: 'stripe',
          provider_subscription_id: payload.subscription,
          // ...
        }, { client: trx });

        await this.eventProcessor.markAsProcessed(eventId, { client: trx });
      });
    }
    ```

---

### **Partie 3 : Frontend (Next.js) - Gestion de l'État**

*La refonte du `AuthContext` reste la même, mais il est crucial de comprendre que le frontend ne fait que **refléter** l'état autorisé par le backend.*
*   Les modifications de l'interface (ex: cacher un bouton "Pro") sont pour l'**expérience utilisateur**, pas pour la **sécurité**. La véritable sécurité est assurée par le backend (voir Partie 4).

---

### **Partie 4 : Architecture de Sécurité et Accès aux Données (Backend)**

*Cette section reste valide et devient encore plus pertinente maintenant que la liaison abonnement-entité est correctement établie.*

1.  **Le Backend comme Source de Vérité :** Chaque requête API sensible doit re-valider les permissions de l'utilisateur en se basant sur son `effectiveSubscriptionTier`.
2.  **Politiques d'Accès avec Bouncer :** Utilise des politiques pour centraliser la logique d'autorisation basée sur le tier.
3.  **Filtrage des Données dans les Réponses API :** Les endpoints de l'API doivent adapter les données qu'ils renvoient en fonction du niveau d'abonnement.

---

**Résumé des Tâches Clés à Générer (Finalisé et Sécurisé) :**

1.  **Backend :**
    *   Générer les migrations pour les nouvelles tables `payment_customers`, `products`, `prices`, et modifier `subscriptions`.
    *   Implémenter le endpoint de webhook avec **vérification de signature**, idempotence via `client_reference_id`, et transactions.
    *   Sécuriser les endpoints de création de session, en s'assurant que `client_reference_id` est bien passé.
    *   Implémenter des politiques Bouncer pour contrôler l'accès aux fonctionnalités clés.
2.  **Frontend :**
    *   Refactoriser `AuthContext` pour gérer l'état de l'abonnement.
    *   Adapter l'UI à l'état de l'abonnement.