### **Prompt pour Claude Code**

**Persona :** Tu es un développeur full-stack senior, expert en architecture logicielle et spécialiste des systèmes de paiement résilients pour des applications SaaS. Tu portes une attention particulière à la robustesse, à la scalabilité et à l'expérience utilisateur.

**Contexte Impératif :** Le projet possède déjà une structure de modèles pour la gestion des abonnements : `User`, `Team`, `Subscription`, et `SubscriptionTier`. Ton travail doit s'intégrer **parfaitement** à cette structure existante. **Ne modifie pas les signatures des méthodes existantes sur les modèles `User` et `Team`.**

**Objectif Général :**
Intégrer un système de paiement complet, résilient et scalable, en s'appuyant sur la structure d'abonnement existante. Le système doit utiliser une couche d'abstraction pour être agnostique au fournisseur de paiement. L'implémentation initiale ciblera Stripe.

---

### **Partie 1 : Abstraction du Fournisseur de Paiement**

*Cette partie reste conceptuellement la même.*

1.  **Interface `PaymentProvider`** (`apps/api/app/services/types/payment_provider.ts`):
    *   `createCheckoutSession(...)`
    *   `createCustomerPortalSession(...)`
    *   `handleWebhook(...)`
2.  **Service `PaymentService`** (`apps/api/app/services/`).
3.  **Implémentation `StripeProvider`** (`apps/api/app/services/providers/`).

---

### **Partie 2 : Backend (AdonisJS) - Architecture de Paiement Robuste**

#### **2.1. Schéma de la Base de Données (Architecture Flexible)**

Pour garantir la flexibilité (prix régionaux, A/B testing), nous allons utiliser un schéma plus granulaire que précédemment.

1.  **Nouvelle Table `products`**
    *   Crée une migration pour une table `products`.
    *   Elle doit avoir une relation `belongsTo` avec `subscription_tiers`. Un "Tier" peut avoir plusieurs "Products" (ex: un produit Stripe, un produit LemonSqueezy).
    *   Colonnes : `id`, `tier_id` (fk), `provider_name` (string), `provider_product_id` (string).

2.  **Nouvelle Table `prices`**
    *   Crée une migration pour une table `prices`.
    *   Elle doit avoir une relation `belongsTo` avec `products`. Un "Product" peut avoir plusieurs "Prices".
    *   Colonnes : `id`, `product_id` (fk), `provider_price_id` (string), `interval` (enum: 'month', 'year'), `currency` (string), `unit_amount` (integer).

3.  **Table `subscriptions` (Modification)**
    *   Ajoute une migration pour inclure : `provider_name` (string) et `provider_subscription_id` (string, indexé, unique).

4.  **Nouvelle Table `customers`**
    *   Colonnes : `id`, `user_id` (fk), `provider_name` (string), `provider_customer_id` (string, unique).

#### **2.2. Modèles AdonisJS**

*   Crée les modèles `Product`, `Price`, et `Customer`.
*   Mets à jour le modèle `Subscription` avec les nouveaux champs.
*   Établis toutes les relations ORM (`hasMany`, `belongsTo`).

#### **2.3. Gestion des Webhooks : Fiabilité et Résilience (Section Critique)**

Dans `StripeProvider`, la méthode `handleWebhook` doit être conçue pour être de qualité production.

1.  **Idempotence :**
    *   Chaque événement Stripe a un ID unique (`evt_...`). Avant de traiter un événement, vérifie si cet ID n'a pas déjà été traité. Stocke les ID des événements traités (par exemple, dans une table `processed_events` ou dans Redis avec une expiration) pour éviter les doubles traitements.

2.  **Transactions Atomiques :**
    *   Enveloppe **toutes** les opérations de base de données liées à un même événement webhook dans une transaction (`Database.transaction()`). Si une seule opération échoue (ex: la mise à jour de la souscription après la création du client), tout doit être annulé pour éviter un état incohérent.

3.  **Gestion des Erreurs et Réessais :**
    *   La logique de traitement doit être dans un bloc `try...catch`.
    *   En cas d'erreur inattendue, logue l'erreur de manière détaillée, puis retourne un statut `500` à Stripe. Cela indiquera à Stripe de réessayer d'envoyer le webhook plus tard.
    *   Réponds `200 OK` uniquement après un traitement réussi.

4.  **Logique de Traitement (Exemple pour `checkout.session.completed`) :**
    ```typescript
    // Pseudocode pour le webhook handler
    async handleCheckoutCompleted(payload) {
      const eventId = payload.id;
      if (await this.eventProcessor.hasBeenProcessed(eventId)) {
        return; // Idempotence
      }

      await Database.transaction(async (trx) => {
        // 1. Récupère ou crée le Customer
        const customer = await Customer.updateOrCreate(..., { client: trx });
        
        // 2. Trouve le Price local via le provider_price_id de la session
        const price = await Price.findBy('provider_price_id', payload.lines.data[0].price.id);

        // 3. Invalide les anciennes souscriptions
        await Subscription.query({ client: trx }).forUser(...).update({ status: 'cancelled' });

        // 4. Crée la nouvelle souscription
        await Subscription.create({
          ...,
          provider_subscription_id: payload.subscription,
        }, { client: trx });

        // 5. Marque l'événement comme traité
        await this.eventProcessor.markAsProcessed(eventId, { client: trx });
      });
    }
    ```

---

### **Partie 3 : Frontend (Next.js) - Gestion de l'État Asynchrone**

Le passage des méthodes du modèle `User` en `async` a un impact significatif. Voici comment le gérer proprement.

#### **3.1. Mise à jour du `AuthContext`**

Le contexte d'authentification doit devenir la source de vérité pour l'état de l'abonnement côté client.

1.  **État dans le Contexte :**
    *   Ajoute l'état de l'abonnement au contexte : `subscription: Subscription | null`, `tier: SubscriptionTier | null`, `isLoadingSubscription: boolean`.

2.  **Chargement des Données :**
    *   Lors de l'appel à la fonction `login` ou `fetchUser` dans le contexte, après avoir récupéré l'utilisateur, fais un appel supplémentaire à un nouvel endpoint API (ex: `GET /auth/me/subscription`) pour récupérer l'abonnement actif et le tier.
    *   Pendant ce chargement, `isLoadingSubscription` doit être `true`.

3.  **Hook `useSubscription` :**
    *   Ce hook ne fera plus d'appel API. Il lira simplement les valeurs (`subscription`, `tier`, `isLoadingSubscription`) depuis le `AuthContext`.

4.  **Refetching :**
    *   Expose une fonction `refetchSubscription()` depuis le contexte.
    *   Cette fonction sera appelée stratégiquement, par exemple dans un `useEffect` sur la page `/dashboard` si l'URL contient `?checkout=success`, pour rafraîchir l'état de l'abonnement sans que l'utilisateur ait à se déconnecter/reconnecter.

#### **3.2. Adaptation des Composants**

*   Les composants qui dépendent de l'abonnement (ex: un HOC `Gate`) utiliseront le hook `useSubscription`.
*   Ils devront maintenant gérer l'état `isLoadingSubscription` pour afficher un spinner ou un état désactivé, évitant ainsi le "flickering" de l'interface.
    ```typescript
    // Exemple dans un composant
    const { tier, isLoadingSubscription } = useSubscription();

    if (isLoadingSubscription) {
      return <Spinner />;
    }

    if (tier?.slug !== 'pro') {
      return <AccessDenied />;
    }

    return <ProFeature />;
    ```

---

**Résumé des Tâches Clés à Générer (Révisé) :**

1.  **Backend :**
    *   Générer les migrations pour les nouvelles tables `products` et `prices`, et modifier `subscriptions`.
    *   Implémenter une logique de webhook **robuste** avec idempotence et transactions.
2.  **Frontend :**
    *   **Refactoriser `AuthContext`** pour qu'il gère l'état de l'abonnement de manière asynchrone.
    *   Mettre à jour les composants pour qu'ils gèrent l'état de chargement de l'abonnement.
    *   Créer un endpoint API pour récupérer l'abonnement de l'utilisateur authentifié.
