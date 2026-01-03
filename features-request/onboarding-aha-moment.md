# Feature Request: Personalized Onboarding for Faster "Aha! Moment"

<context>
Vous êtes un Expert en UX Design et Product Growth. 
Défi : Les utilisateurs abandonnent le SaaS après l'inscription car le dashboard est vide et ils ne savent pas par où commencer.
</context>

<instructions>
Créez un flux d'onboarding post-inscription qui génère de la valeur immédiate.

Tâches :
1. Créez une étape intermédiaire après le "Sign up" demandant le nom de l'équipe et l'objectif principal.
2. Implémentez un service backend qui crée automatiquement des données d'exemple (mock data) en fonction de l'objectif choisi.
3. Développez une checklist interactive sur le Dashboard qui guide l'utilisateur vers sa première action clé.
</instructions>

<thinking>
- Quelles sont les 3 actions critiques qui prédisent la conversion d'un utilisateur gratuit en payant ?
- Comment rendre l'onboarding "skippable" pour les utilisateurs experts tout en restant incitatif pour les novices ?
</thinking>

<critique_and_refine>
1. **Réponse Initiale** : Composant `OnboardingWizard` et service de seeding de données.
2. **Critique Sceptique** : Analysez la friction ajoutée par les étapes supplémentaires. Est-ce que trop de questions au début font fuir les gens ?
3. **Réponse Finale** : Onboarding "progressif" : demandez le minimum au début, et débloquez la checklist seulement après la première visite du dashboard.
</critique_and_refine>
