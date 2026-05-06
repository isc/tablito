# Multiplix — Spécifications fonctionnelles

**Application d'apprentissage des tables de multiplication basée sur la recherche en sciences cognitives**

Utilisatrice cible : Zoé, 8 ans, CE2 — Tables de 1 à 10

---

## 1. Principes scientifiques fondateurs

L'application repose sur quatre piliers issus de la littérature en psychologie cognitive et en didactique des mathématiques :

### 1.1 Répétition espacée (Spaced Repetition)

**Source :** Kang (2016), Cepeda et al. (2008), Rea & Modigliani (1985)

Chaque fait multiplicatif possède un état de maîtrise individuel. L'intervalle entre deux présentations d'un même fait augmente avec les succès consécutifs et se réduit en cas d'erreur. L'algorithme s'inspire du système de Leitner à 5 boîtes, adapté pour des enfants.

| Boîte | Intervalle de révision | Signification |
|-------|----------------------|---------------|
| 1 | Chaque séance | Nouveau ou échoué récemment |
| 2 | 1 jour | Répondu correctement 1 fois |
| 3 | 3 jours | Répondu correctement 2 fois consécutives |
| 4 | 7 jours | Répondu correctement 3 fois consécutives |
| 5 | 21 jours | Maîtrisé (révision de consolidation) |

**Règles :**
- Un succès fait monter le fait d'une boîte.
- Un échec renvoie le fait en boîte 1.
- Un fait est considéré "acquis" quand il atteint la boîte 5 et y est confirmé.
- Le temps de réponse est enregistré. Un succès lent (> 5 secondes) ne fait pas monter de boîte — l'objectif est le rappel automatique, pas le calcul mental.

### 1.2 Regroupement par faible similarité (Low-Interference Training)

**Source :** Dotan & Zviran-Ginat (2022), *Cognitive Research: Principles and Implications*

Les faits similaires (ex : 6×8=48 et 8×8=64) créent de l'interférence en mémoire lorsqu'ils sont présentés dans la même séance. L'application regroupe les faits de sorte qu'une séance ne contienne que des faits dissemblables entre eux.

**Commutativité :** a×b et b×a (ex : 6×7 et 7×6) sont traités comme un seul et même fait. L'application ne stocke qu'une entrée (avec a ≤ b par convention) mais pose la question dans les deux ordres.

**Critères de similarité entre deux faits a×b=c et d×e=f :**
- Opérande partagé (ex : 7×6 et 7×8) → similarité forte
- Résultat proche ou même dizaine (ex : 6×7=42 et 6×8=48) → similarité moyenne
- Chiffre partagé dans le résultat (ex : 8×8=64 et 8×6=48, tous deux avec un 8 en opérande et un 4 dans le résultat) → similarité moyenne

*Note sur la métrique :* Dotan & Zviran-Ginat utilisent une métrique différente dans leur étude : le nombre de paires de chiffres communes entre deux faits (opérandes et chiffres du résultat confondus, positions ignorées). Leur métrique est continue et ne distingue pas le rôle du chiffre (opérande vs. résultat). Notre métrique catégorielle (forte/moyenne/nulle) est plus conservatrice — elle classe comme « similarité forte » tout partage d'opérande, même quand la métrique du papier donnerait un score de 0 (ex : 8×7=56 et 8×3=24 ne partagent qu'un seul chiffre, donc 0 paires, mais partagent l'opérande 8). Ce choix est aligné avec la littérature plus large sur les erreurs de récupération en multiplication (Campbell, 1987), qui identifie le partage d'opérande comme la première source de confusion.

**Règle de séance :** Dans une séance donnée, deux faits ayant une similarité forte ne sont jamais présentés dans la même série de questions. Deux **introductions** de faits similaires sont espacées d'au moins 48h — l'interférence vise l'apprentissage de paires similaires (Dotan & Zviran-Ginat 2022), pas la révision active. Une fois un fait appris (en boîte ≥ 2 et revu régulièrement), le revoir ne bloque pas l'introduction d'un fait similaire.

### 1.3 Entrelacement (Interleaving)

**Source :** Rohrer & Taylor (2007), Rohrer, Dedrick & Burgess (2014)

Au sein d'une séance, les questions alternent entre différentes tables plutôt que de travailler une seule table en bloc. L'entrelacement force la discrimination active et améliore les performances d'environ 30% par rapport à la pratique bloquée.

**Implémentation :** Chaque séance pioche dans les faits éligibles (selon l'algorithme de répétition espacée) et les mélange. Jamais deux questions consécutives de la même table.

### 1.4 Compréhension conceptuelle avant mémorisation

**Source :** Cowan et al. (2011), Brendefur et al. (2015)

Avant de demander un rappel pur, chaque nouveau fait est d'abord introduit visuellement (array/grille de points, lien avec l'addition répétée, commutativité). L'application ne demande jamais de mémoriser un fait qui n'a pas été conceptuellement présenté.

---

## 2. Architecture de l'application

### 2.1 Stack technique

| Composant | Choix | Justification |
|-----------|-------|---------------|
| Framework | React (JSX, single-file artifact ou PWA) | Interactivité riche, animations |
| Stockage | localStorage + export/import JSON | Persistance entre séances, pas de backend |
| Animations | CSS transitions + Framer Motion ou CSS keyframes | Feedback visuel motivant |
| PWA | Service Worker + manifest.json | Installable, fonctionne hors-ligne |
| Hébergement | GitHub Pages (repo `isc/multiplix`) | Gratuit, simple |

### 2.2 Structure des données

```typescript
interface MultiFact {
  a: number;           // premier opérande (2-10)
  b: number;           // second opérande (2-10), toujours a ≤ b (commutativité)
  product: number;     // résultat
  box: 1 | 2 | 3 | 4 | 5;  // boîte Leitner
  lastSeen: string;    // ISO date de dernière présentation
  nextDue: string;     // ISO date de prochaine révision
  history: Attempt[];  // historique des tentatives
  introduced: boolean; // le fait a-t-il été présenté conceptuellement ?
}

interface Attempt {
  date: string;
  correct: boolean;
  responseTimeMs: number;
  answeredWith: number | null;  // ce que l'enfant a répondu
}

interface UserProfile {
  name: string;
  startDate: string;
  facts: MultiFact[];
  totalSessions: number;
  currentStreak: number;     // jours consécutifs
  longestStreak: number;
  badges: Badge[];
}

interface Badge {
  id: string;
  name: string;
  description: string;
  earnedDate: string;
  icon: string;
}
```

### 2.3 Inventaire des faits

En exploitant la commutativité (a×b = b×a), on réduit les 100 faits (1-10 × 1-10) aux faits uniques :

- Tables de 1 et 10 : triviaux → traités à part (règle, pas mémorisation)
- Carrés : 2×2, 3×3, ..., 9×9 → 8 faits
- Faits non-carrés (a < b, 2 ≤ a ≤ 9, a < b ≤ 9) → 28 faits
- **Total à mémoriser : 36 faits** (après exclusion des ×1 et ×10)

Les faits ×1 et ×10 sont enseignés comme des **règles** (pas de la mémorisation) lors de la phase d'introduction.

**Formulation pédagogique des règles :**

- **×1** : « Tout nombre multiplié par 1 reste le même. »
- **×10** : « Les chiffres glissent d'une place vers la gauche : un 0 vient prendre la place des unités. »

La formulation classique « on ajoute un zéro » est volontairement évitée : le verbe « ajouter » prête à confusion avec l'addition, et la règle devient fausse dès l'introduction des nombres décimaux (1,2 × 10 = 12, et non 1,20). Le principe du « glisse-nombre » — décalage des chiffres dans le tableau de numération (unités → dizaines, dizaines → centaines, etc.) — est la formulation recommandée par plusieurs sources pédagogiques françaises :

- [Le glisse-nombre — Collège Eugène Delacroix](https://eugenedelacroix.arsene76.fr/matieres-enseignees/mathematiques/le-glisse-nombre-ou-comment-comprendre-la-multiplication-par-10--2939.htm)
- [Multiplier par 10, 100, 1000 — Maître Lucas](https://maitrelucas.fr/lecons/multiplier-par-10-100-1000/)
- [La table de 10 — Maître Lucas](https://maitrelucas.fr/lecons/la-table-de-10/)
- [Erreurs de multiplication et division — Mathsansbosse](https://mathsansbosse.fr/content/erreurs-de-multiplication-et-division)
- [Multiplier par 10, 100 ou 1000 — SchoolMouv](https://www.schoolmouv.fr/cours/multiplier-par-10-100-ou-1000/fiche-de-cours)
- [Décalage à gauche ou à droite ? — Neoprofs](https://www.neoprofs.org/t131596-decalage-a-gauche-ou-a-droite)

---

## 3. Parcours utilisateur

### 3.1 Premier lancement

1. Écran d'accueil avec le personnage mascotte (voir §4)
2. Saisie du prénom → "Salut Zoé !"
3. Explication ludique : "Je suis [Mascotte]. On va apprendre les multiplications ensemble, 5 minutes par jour !"
4. Test de positionnement rapide (optionnel) : 15 faits mélangés, pas de timer visible → détermine quels faits sont déjà connus pour démarrer à la bonne boîte. Un bouton **« Je ne sais pas »** permet de passer une question sans forcer une réponse au hasard ; c'est traité comme une erreur (placement en boîte 1), ce qui évite de polluer le diagnostic avec des bonnes réponses devinées. Une voix d'intro (`placement-intro`) annonce l'option au démarrage du test.

   **Inférence par dominance** : les 21 faits non testés sont ensuite inférés à partir des résultats du placement. Un fait `(a, b)` est marqué introduit en boîte 2 s'il existe un fait testé `(a', b')` correctement résolu avec `a' ≥ a ET b' ≥ b` (avec normalisation min/max) — l'idée étant qu'un enfant qui sait `6×9` sait aussi `2×3`. Sans ça, l'image mystère cacherait les cases « faciles » et la règle boîte≥2 (§3.4bis) bloquerait l'introduction de 2×2 et 2×3. Les faits non dominés (typiquement 8×9, 9×9) restent à introduire via le rythme normal.
5. Introduction des règles ×1 et ×10 (écran `RulesIntroScreen`) — affiché une fois, juste après le test de positionnement. Trois étapes : accueil (« Deux règles toutes simples »), règle ×1 avec exemples, règle ×10 avec visuel du « glisse-nombre » (animation : un chiffre glisse de la colonne des unités vers celle des dizaines, un 0 apparaît aux unités). Le passage est persisté via `UserProfile.hasSeenRulesIntro` pour ne pas le rejouer.
6. Première séance avec les 2 premiers faits (les plus simples : 2×2 et 2×3). Le plafond de 2 nouveaux faits par séance (§3.4bis) s'applique dès la première séance — 2×4 et 2×5 sont introduits aux séances suivantes quand 2×2 et 2×3 sont en boîte 2+.

**Rappel contextuel de la règle ×10 dans l'intro des faits ×9 :**

La stratégie des faits ×9 étant « n × 9 = n × 10 − n » (voir §4 et `lib/strategies.ts`), le composant `StrategyHint` affiche un rappel discret de la règle ×10 sous l'astuce quand la variante est `intro` et que la stratégie est `near-ten`. Cela réactive la règle au seul moment de la session où elle est effectivement mobilisée — puisque les faits ×1 et ×10 eux-mêmes ne sont jamais posés en question.

### 3.2 Séance quotidienne (5 minutes)

**Structure d'une séance :**

```
[Accueil]          → Personnage + rappel de la streak + badge du jour si applicable
    ↓
[Intro]            → Si nouveaux faits à introduire (max 2 par séance) :
                     affichage visuel (grille de points), explication, 
                     puis première question immédiate
    ↓
[Pratique]         → Jusqu'à 12-15 questions (mix de révisions dues + faits récents)
                     Entrelacement automatique, pas de chrono visible
                     Feedback immédiat après chaque réponse
                     Note : si moins de faits sont disponibles, la séance est
                     plus courte — pas de répétition de remplissage (voir §6.2)
    ↓
[Récap]            → Bilan orienté progrès (faits appris, faits promus,
                     progression vers la maîtrise globale), badge éventuel,
                     message chaleureux constant (pas conditionné au score)
    ↓
[Fin]              → "À demain !" + mascotte
```

**Durée cible :** 4-6 minutes. L'application ne coupe pas en plein milieu d'une question mais affiche un indicateur de progression (barre ou étoiles à remplir).

**Justification du choix de durée.** La littérature ne fixe pas de minute optimale unique : ce qui est étayé empiriquement, c'est la *forme* (séances courtes, fréquentes, distribuées), pas un chiffre précis. Les études d'intervention sur la fluence des faits arithmétiques s'étalent typiquement entre **5 et 20 min/séance**, avec un cluster autour de **10-15 min** dans les contextes scolaires de remédiation (Codding, Burns & Lukito 2011 ; Burns, Kanive & DeGrande 2012). La méta-analyse de Codding et al. (2011) traite d'ailleurs la dose comme un produit `sessions × semaines` plutôt qu'en minutes/séance — autrement dit, **la régularité quotidienne pèse plus que la longueur de chaque séance**. Notre cible de 4-6 minutes est donc volontairement au bas de la fourchette evidence-based : elle privilégie la consistance quotidienne (compatible avec un usage à la maison, sans supervision) plutôt que la dose par séance, et reste dans la zone confortable d'attention pour des enfants de 7-9 ans avant l'apparition de fatigue cognitive sur ce type de tâche répétitive.

### 3.3 Déroulement d'une question

1. Affichage de la question : "6 × 7 = ?"
   - Les opérandes peuvent être présentés dans les deux ordres (6×7 ou 7×6) même si le fait est stocké une seule fois
   - La question est aussi énoncée à voix haute ("six fois sept") — canal auditif supplémentaire pour les lecteurs hésitants (cf. §3.6)
2. L'enfant tape sa réponse sur un pavé numérique intégré (gros boutons tactiles)
3. Validation automatique à 2 chiffres, ou bouton "OK" pour les résultats < 10
4. **Feedback immédiat :**
   - **Correct + rapide (< 3s) :** Animation joyeuse, son positif, +1 étoile dorée, montée de boîte
   - **Correct + normal (3-5s) :** "Bravo !", montée de boîte
   - **Correct + lent (> 5s) :** "Bravo !", pas de montée de boîte (le retour est positif côté enfant ; la lenteur n'est jamais verbalisée — cf. §7.2 sur le feedback orienté progrès et l'absence de chrono visible)
   - **Incorrect :** Pas de son négatif, la bonne réponse s'affiche avec la grille de points, puis re-pose la question 2-3 questions plus tard dans la même séance

   *Note sur les seuils :* ces seuils tiennent compte du surcoût moteur du pavé numérique (~1-1,5s) par rapport à une réponse orale. Dans la littérature, le rappel automatique est typiquement mesuré sous 1-2s à l'oral. Nos 5s correspondent à environ 3-4s de réflexion + 1-1,5s de manipulation tactile. Si l'application évolue vers une interface vocale (voir audit), les seuils devront être abaissés pour s'aligner avec les mesures de la recherche.

### 3.4 Introduction d'un nouveau fait

Quand l'algorithme décide d'introduire un nouveau fait :

1. **Affichage visuel :** Grille de points (array) animée — ex : 3 rangées de 7 points qui apparaissent une par une
2. **Lien avec l'addition :** "3 × 7, c'est 7 + 7 + 7 = 21"
3. **Commutativité :** La grille pivote de 90° → "7 × 3, c'est pareil ! C'est aussi 21"
4. **Stratégie de dérivation :** Lorsqu'une astuce existe pour le fait (cf. §3.4bis), on montre la dérivation : « × 9, c'est × 10 moins une fois » avec les étapes du calcul.
5. **Première question :** Posée immédiatement après l'introduction
6. **Re-test :** Posée à nouveau 2-3 questions plus tard dans la séance

Chaque étape est accompagnée d'un audio pré-enregistré (`intro-A-B`, `comm-A-B`, `strategy-A-B`) — cf. §3.6.

### 3.4bis Stratégies de dérivation

**Sources :**
- Brendefur, J., Strother, S., Thiede, K., Lane, C., & Surges-Prokop, M. J. (2015). *A Professional Development Program to Improve Math Skills Among Preschool Children in Head Start.* Boise State ScholarWorks. <https://scholarworks.boisestate.edu/cifs_facpubs/150/>
- Wichita Public Schools (2014). *Multiplication Fact Strategies* (Van de Walle / DMT framework). <https://teachers.stjohns.k12.fl.us/ford-t/files/2021/09/Multiplication-Fact-Strategies.pdf>
- DMT Institute. *Drills vs. Strategies: Building Flexible Thinking with Multiplication Facts.* <https://mathsuccess.dmtinstitute.com/p/drills-vs-strategies-building-flexible>

La mémorisation par cœur pure est moins robuste que la **pratique stratégique**, où l'enfant dérive le résultat à partir de faits plus simples (anchor facts). Avec la répétition, la dérivation s'automatise et la trace mnésique se consolide — et si l'enfant oublie, il conserve un filet de secours.

Les stratégies sont affichées :
- **à l'introduction** (étape 4 ci-dessus) — pour installer l'idée qu'on peut dériver,
- **en cas d'erreur, uniquement pour les faits en boîte ≤ 2** — au-delà, on vise le rappel direct, la grille suffit comme rappel conceptuel.

L'astuce est également énoncée à voix haute aux deux moments (`strategy-A-B`, cf. §3.6).

#### Séquence canonique d'introduction (Van de Walle / Wichita 2014)

Les nouveaux faits sont introduits dans cet ordre (anchor facts d'abord, dérivés ensuite) :

1. **Doubles** (×2) — addition répétée, fondation pour ×3 et ×4
2. **Fives** (×5) — skip counting, fondation pour ×6 et ×7
3. **Nines** (×9) — astuce ×10 − n, anchor visuel fort
4. **Squares** (n × n) — anchors mémorables, appui pour les voisins (×6, ×7, ×8)
5. **Derived** — le reste (3×4, 3×6, 3×7, 3×8, 4×6, 4×7, 4×8, 6×7, 6×8, 7×8)

Implémenté dans `factStage()` (`src/lib/sessionComposer.ts`).

#### Stratégies utilisées (par ordre de priorité quand plusieurs s'appliquent)

| Pivot | Astuce | Exemple |
|-------|--------|---------|
| × 9 | near-ten : × 10 moins une fois | 7 × 9 = 7 × 10 − 7 = 63 |
| × 5 | skip-count : compter par 5 | 4 × 5 = 5 + 5 + 5 + 5 = 20 (on compte : 5 → 10 → 15 → 20) |
| × 3 | double-add : × 2 plus une fois | 7 × 3 = 7 × 2 + 7 = 21 |
| × 4 | double-double : doubler le double | 6 × 4 = (6 × 2) × 2 = 24 |
| × 6 | five-plus-one : × 5 plus une fois | 7 × 6 = 7 × 5 + 7 = 42 |
| × 7 | five-plus-two : × 5 plus × 2 | 8 × 7 = 8 × 5 + 8 × 2 = 56 |
| × 8 | double-double-double : doubler trois fois (8 = 2³) | 7 × 8 = 7 × 2 × 2 × 2 = 14 × 2 × 2 = 28 × 2 = 56 |

**Notes sur les choix :**
- ×5 utilise le skip counting plutôt que « moitié de × 10 », conformément à la séquence canonique : compter par 5 est l'anchor naturel et intuitif (les multiples de 5 se terminent par 0 ou 5).
- ×8 utilise le doublement triple plutôt que « × 10 − × 2 », car il s'appuie directement sur l'anchor des doubles (déjà maîtrisé en stage 1) et exploite la structure 8 = 2³.

Faits de base sans stratégie (grille + addition répétée suffisent) : table de 2, 3 × 3.

**Rythme d'introduction :** Maximum 2 nouveaux faits par séance. Un nouveau fait n'est introduit que si les faits précédemment introduits sont au moins en boîte 2.

**Exception phase finale :** quand il ne reste que ≤ 2 faits à introduire (typiquement 8×9 et 9×9 après le seeding par dominance du placement, qui ne peuvent être inférés par aucun fait du set placement), la règle boîte≥2 est levée. Sinon un seul fait raté en boîte 1 bloquerait indéfiniment l'introduction des derniers faits — alors que l'enfant maîtrise déjà la quasi-totalité, la règle protectrice n'a plus d'utilité.

### 3.5 Récap de séance

**Source :** Butler (1988), Hattie & Timperley (2007)

L'écran de récap ne doit jamais afficher de score brut (ex : "8/12 bonnes réponses") ni d'indicateur de performance comparative (étoiles conditionnées au ratio de réussite). Ce type de feedback ego-involving réduit la motivation intrinsèque et oriente l'enfant vers des objectifs de performance plutôt que de maîtrise.

**Ce qui est affiché :**
- **Message chaleureux constant** — identique quel que soit le résultat de la séance. L'enfant a fait sa séance, c'est l'essentiel.
- **Nouveaux faits** — nombre de faits introduits dans la séance
- **Invitation à l'image mystère** — bouton vers l'écran de progression (§5.1). Libellé neutre *« Voir mon image »* par défaut ; libellé valorisant *« Ton image a changé ! Viens la voir »* uniquement quand au moins un fait a réellement monté de boîte dans la séance (comparaison boîte initiale → boîte finale, pas un simple compteur de bonnes réponses). Le nombre exact de faits promus n'est pas affiché : la métaphore visuelle suffit, et chiffrer la progression risquerait de réintroduire un signal ego-involving.
- **Progression globale** — avancement vers la maîtrise complète (ex : "Tu connais 18 faits sur 36" ou jauge de progression)
- **Badges éventuels** — récompenses orientées effort et maîtrise
- **Tables complétées** — avec célébration (confettis)

**Ce qui n'est PAS affiché à l'enfant :**
- Score brut (correct/total)
- Étoiles ou notes conditionnées au ratio de réussite
- Messages d'encouragement dont le ton varie selon le score
- Nombre d'erreurs

*Le score brut, le taux de réussite et le temps de réponse moyen sont disponibles dans le tableau de bord parent (§5.2).*

### 3.6 Audio (text-to-speech)

L'application lit à voix haute les étapes-clés d'une séance — canal auditif supplémentaire, utile aux lecteurs hésitants et aux enfants qui automatisent mieux à l'oral.

**Fichiers pré-générés** (voix française *Marie – Curious*, Mistral Voxtral TTS) stockés dans `public/audio/tts/` :

| Clé | Contenu | Nombre |
|-----|---------|--------|
| `q-A-B` | « A fois B » — énoncé de la question | 64 |
| `intro-A-B` | « Nouveau ! A fois B, c'est B + B + … = P » | 36 |
| `comm-A-B` | « B fois A, c'est pareil ! C'est aussi P » | 28 |
| `strategy-A-B` | Astuce de dérivation parlée (cf. §3.4bis) | 27 |
| `welcome-*`, `recap-done` | Phrases statiques du parcours de bienvenue et du récap | 4 |

Génération : `MISTRAL_API_KEY=… node scripts/generate-tts.mjs` (idempotent — skip les fichiers déjà présents). Les mêmes fichiers sont servis offline via le precache de la PWA.

Coupure son : bouton mute global qui persiste l'état dans `localStorage`.

### 3.6bis Entrée vocale (mode optionnel)

En complément du pavé numérique, un mode vocal permet à l'enfant de répondre à voix haute (Web Speech API, `SpeechRecognition`). Utile pour les enfants qui ont déjà automatisé le fait mais sont ralentis par la manipulation tactile, ou pour soulager la charge motrice sur une longue séance.

**Activation :** toggle dans la barre supérieure de l'écran d'accueil (icône micro ↔ clavier). Le toggle n'apparaît que si `SpeechRecognition` est supportée par le navigateur. Le choix est persisté dans `localStorage` pour survivre aux rechargements.

**Seuils de temps ajustés :** en mode vocal, les seuils « rapide » et « lent » sont abaissés à 2 s et 3 s (contre 3 s et 5 s en mode clavier). Cela aligne les seuils avec les mesures d'automatisation à l'oral dans la littérature (§3.3) en retirant le surcoût moteur du pavé numérique.

**Robustesse :** le module `parseFrenchAnswer` normalise les réponses parlées (nombres en lettres, variations régionales — « soixante-douze », « septante-deux ») et filtre l'écho du TTS quand la question est énoncée juste avant la réponse.

---

## 4. Gamification

### 4.1 Personnage mascotte

Un petit personnage **stable** qui accompagne l'enfant tout au long du parcours. La mascotte ne porte pas la progression (ce rôle revient à l'image mystère, §5.1) : elle est un **compagnon affectif**, pas une récompense à faire évoluer.

**Rôles :**
- Présence sur l'écran d'accueil (animations d'idle)
- Feedback immédiat pendant la séance : réactions joyeuses aux bonnes réponses, encouragements neutres et positifs aux erreurs (**jamais de moue, jamais de déception**)
- Ritualisation : bienvenue en début de séance, « à demain ! » en fin
- Identité visuelle de l'app (icône, écran de lancement)

**Principe :** la mascotte n'évolue pas, ne « grandit » pas, n'a pas de niveau. Elle est le même visage familier à chaque séance, du premier jour au dernier fait maîtrisé. Ce choix évite :
- le doublon avec la progression de l'image mystère (deux métaphores de progression qui se parasitent),
- la logique « œuf → adulte » qui, une fois terminée, ne peut plus motiver,
- toute forme de jugement (« faire la moue ») qui contredirait le principe *un fait oublié revient sans notion d'échec* (§1.1).

### 4.2 Badges

| Badge | Condition | Icône |
|-------|-----------|-------|
| Premier pas | Terminer la 1ère séance | 🌱 |
| Première case révélée | Premier fait passé en boîte 4 (1ère case quasi-nette sur l'image mystère) | 🖼️ |
| Première multiplication maîtrisée | Premier fait passé en boîte 5 (1ère case entièrement dévoilée) | 🥇 |
| Régularité | 7 jours consécutifs | 🔥 |
| Machine | 10 réponses correctes d'affilée dans une séance | ⚡ |
| Exploration | Avoir vu tous les faits au moins une fois | 🗺️ |
| Table de [N] | Maîtriser tous les faits d'une table | ⭐ |
| Génie des maths | Tous les faits en boîte 5 | 🏆 |
| Véloce | 5 réponses < 2s d'affilée | 🚀 |
| Persévérance | Revenir après 3+ jours d'absence | 💪 |
| Flamme éternelle | 30 jours consécutifs | 🌟 |

Les deux badges *Première case révélée* et *Première multiplication maîtrisée* jalonnent la zone intermédiaire, entre les badges du tout début (Premier pas, Machine, Exploration) et la maîtrise complète d'une table : ils se déclenchent au moment précis où l'image mystère §5.1 change visiblement de finesse pour la 1ère fois.

Sur l'écran *Badges*, **chaque vignette est cliquable** et ouvre une modale qui explicite le badge :
- pour un badge **verrouillé** : la condition complète, et — quand c'est applicable — une **barre de progression** (jours consécutifs, faits découverts, faits dans la table en boîte 4+, etc.) avec un encouragement contextuel (« Plus que 3 ! Tu y es presque. »).
- pour un badge **débloqué** : la condition rappelée, et la **date d'obtention**.

Cette modale est essentielle pour un enfant qui découvre la gamification : sans elle, l'icône et le nom seuls ne permettent pas de comprendre comment décrocher le badge.

### 4.3 Streak (série de jours)

- Compteur de jours consécutifs affiché sur l'écran d'accueil
- Animation de flamme qui grandit avec la streak
- Si l'enfant manque un jour : message bienveillant ("Tu m'as manqué ! On s'y remet ?"), pas de punition, la streak repart de 1 mais les progrès sur les faits sont conservés

### 4.4 Célébration de table complète

Quand tous les faits d'une table passent en boîte 4+ :
- Animation spéciale (feu d'artifice, confettis)
- La ligne et la colonne correspondantes s'illuminent brièvement sur l'image mystère
- Badge spécifique

---

## 5. Suivi de progression

### 5.1 Vue enfant : l'image mystère

La progression de l'enfant se matérialise par **une image unique qui se révèle au fil des séances**. La grille 8×8 (tables 2 à 9, les ×1 et ×10 étant traités comme règles §3.1 et donc non représentés) constitue le support : chaque case affiche un **fragment** de l'image globale, et la finesse de chaque fragment reflète la boîte Leitner du fait correspondant.

**Cinq niveaux de finesse (alignés sur les 5 boîtes Leitner) :**

| État du fait | État visuel du fragment |
|--------------|-------------------------|
| Non introduit | Case opaque (fragment masqué) |
| Boîte 1 | Silhouette floue |
| Boîte 2 | Aplat simple, forme reconnaissable |
| Boîte 3 | Couleurs principales |
| Boîte 4 | Ombres et volumes |
| Boîte 5 | Détails fins, fragment complet |

À mesure que les faits progressent, la scène globale se compose. Un fait qui redescend de boîte (oubli) fait redescendre sa case d'un cran en finesse — pas d'échec, juste la brume qui revient. Ce comportement est le miroir visuel strict de l'algorithme Leitner (§1.1).

**Commutativité visible :** comme (a,b) et (b,a) sont un seul et même fait (§1.2), les deux cases miroir se révèlent **en synchrone**. Elles affichent des fragments différents de l'image globale, mais évoluent toujours ensemble à chaque maîtrise ou oubli. Ce parallélisme visuel renforce pédagogiquement le principe de commutativité.

**Fin de parcours :** quand les 36 faits sont en boîte 5, l'image est entièrement révélée. Une **brève animation** (un clin d'œil, un léger mouvement) marque la complétion, sans pop-up ni célébration envahissante. L'image reste ensuite affichée comme témoin de la réussite ; pendant la phase de maintenance (révisions tous les 21 jours), si un fait retombe, sa case se re-floute en miroir de l'algo et se re-révèle à la révision suivante réussie.

**Interaction :** en tapant sur une case, l'enfant voit le fait sous-jacent et la grille de points associée.

**Choix de l'image :** une scène riche, non genrée, sans texte, au style cohérent sur toute la grille. L'image a une valeur symbolique forte — c'est **l'image de la réussite**, pas une vignette interchangeable dans une collection. Production envisagée : une image vectorielle maître, dont les 5 niveaux de finesse sont générés algorithmiquement (flou progressif + simplification des chemins), ou un pixel-art avec résolutions croissantes par case.

**Périmètre v1 :** chaque profil démarre avec **une seule image** pour l'ensemble du parcours, tirée aléatoirement d'un petit pool de thèmes visuels à la création du profil (actuellement `market` et `ocean` — voir `MYSTERY_POOL` dans `src/types.ts` ; un thème `village` est réservé au guide utilisateur pour ne pas spoiler les thèmes réels). L'image suit l'enfant du premier jour au dernier fait maîtrisé — pas de rotation, pas d'album à collectionner. L'objectif de l'app est d'apprendre les tables ; une fois l'image révélée, l'app a rempli son rôle. Si le périmètre s'étend un jour à d'autres matières (divisions, conjugaisons…), chaque matière pourra avoir sa propre image dédiée.

### 5.2 Vue parent : tableau de bord

Accessible depuis l'écran d'accueil via l'icône engrenage. Un tap ouvre une **multiplication-gate** : un petit modal qui demande de résoudre une multiplication à deux opérandes — un entre 11 et 19, l'autre entre 3 et 9 (ex : `14 × 7`). Trivial pour un adulte, hors de portée d'un enfant qui travaille encore les tables 2-9. Le dashboard s'ouvre sur bonne réponse ; une mauvaise réponse génère une nouvelle question sans verrouillage ni compteur d'essais.

**Indicateurs :**
- Nombre de faits par boîte (histogramme)
- **Grille Leitner colorée** 8×8 (une couleur par boîte) — vue diagnostique brute, complémentaire à l'image mystère côté enfant
- Faits les plus difficiles (boîte 1 depuis le plus longtemps, ou le plus d'erreurs)
- Temps de réponse moyen par table
- Historique des séances (date, durée, score)
- Streak actuelle et plus longue
- Graphe d'évolution : nombre de faits maîtrisés (boîte 4+) au fil du temps

**Actions parent :**
- Exporter les données (JSON)
- Importer les données (pour changer de téléphone)
- **Guide utilisateur** : ouvre `/multiplix/guide/` dans un nouvel onglet (page statique servie depuis la même origine, générée par `scripts/generate-user-guide.mjs`)
- **Envoyer un avis** : formulaire texte libre + email optionnel. Les envois atterrissent dans une table Supabase (policy RLS insert-only via la publishable key). Un contexte anonyme (user-agent, viewport, stats agrégées du profil — nombre de séances, faits maîtrisés, streak) est joint pour faciliter le triage. Lecture réservée au propriétaire de l'app via la secret key (stockée en local, hors du repo)

*Note : les paramètres (nombre de questions par séance, seuil de vitesse) ne sont pas exposés car leurs valeurs par défaut sont issues de la littérature scientifique (§1.1) et ne devraient pas être modifiées sans expertise.*

---

## 6. Algorithme de sélection des questions

### 6.1 Priorité de sélection pour une séance

À chaque séance, l'algorithme compose la liste de questions ainsi :

```
1. Faits en boîte 1 dont nextDue ≤ maintenant        (priorité haute)
2. Faits en boîte 2-3 dont nextDue ≤ maintenant       (priorité moyenne)
3. Faits en boîte 4-5 dont nextDue ≤ maintenant       (priorité basse)
4. Nouveaux faits à introduire (max 2)                 (si rien d'urgent)
```

### 6.2 Contraintes de composition

- **Anti-interférence :** Deux faits partageant un opérande ne sont jamais adjacents dans la file de questions (quand c'est possible)
- **Entrelacement :** Jamais deux questions de la même table d'affilée
- **Équilibre :** Si > 15 faits sont éligibles, on priorise les boîtes basses
- **Réintroduction après erreur :** Un fait raté est re-posé 2-3 questions plus tard dans la même séance (et revient en boîte 1 pour les séances suivantes)
- **Borne dure de la séance :** La séance est plafonnée à **20 questions** au total, retries de réintroduction inclus. Sans cette borne, une chaîne d'erreurs (typiquement en mode vocal où la reconnaissance peut rater) insère retry sur retry et rend la séance interminable alors que les points de progression sont déjà tous remplis. Au-delà du cap, les nouvelles erreurs continuent à rétrograder en boîte 1 (effet Leitner préservé) mais ne déclenchent plus de retry intra-séance.
- **Variation d'ordre :** Un même fait est parfois posé comme a×b, parfois comme b×a
- **Pas de répétition de remplissage :** Le nombre 12-15 est un objectif, pas un minimum absolu. Il dérive de la durée cible de 5 minutes (~20-30 s par question avec feedback). Si le nombre de faits distincts disponibles est inférieur à 12, la séance est plus courte plutôt que de répéter les mêmes faits en boucle. La littérature (Cepeda et al. 2008, Rea & Modigliani 1985) montre que c'est la régularité des sessions et les intervalles de révision qui comptent, pas le nombre de questions par session. La répétition massive (massed practice) dans une même séance est contre-productive.
- **Révision bonus :** Quand aucun fait n'est dû et qu'aucun nouveau fait ne peut être introduit (contrainte de similarité 48h), la séance est complétée avec des révisions bonus piochées parmi tous les faits introduits, en priorisant les boîtes les plus basses puis les dates de révision les plus proches. Les révisions bonus donnent un feedback normal (son, mascotte, score) mais **ne modifient pas l'état Leitner** (boîte, nextDue, lastSeen, historique). Cela garantit une séance chaque jour sans perturber le calendrier de répétition espacée.

### 6.3 Calcul de nextDue

```javascript
function computeNextDue(box, lastSeen) {
  const intervals = {
    1: 0,      // immédiat (prochaine séance)
    2: 1,      // 1 jour
    3: 3,      // 3 jours
    4: 7,      // 1 semaine
    5: 21      // 3 semaines
  };
  return addDays(lastSeen, intervals[box]);
}
```

---

## 7. Interface utilisateur

### 7.1 Écrans

| Écran | Contenu |
|-------|---------|
| Accueil | Mascotte (animations d'idle), prénom, streak, bouton "C'est parti !" |
| Séance — Intro | Grille de points animée pour un nouveau fait |
| Séance — Question | Question en gros, pavé numérique, barre de progression |
| Séance — Feedback correct | Animation joyeuse, mascotte enthousiaste |
| Séance — Feedback incorrect | Bonne réponse affichée avec grille, ton bienveillant (mascotte neutre, jamais déçue) |
| Récap séance | Bilan progrès (faits promus, progression globale), badge éventuel, bouton "À demain" |
| Progression | Image mystère (vue enfant, §5.1) ; grille Leitner colorée réservée au dashboard parent (§5.2) |
| Badges | Collection de badges obtenus |
| Parent | Dashboard détaillé (accès protégé) |

### 7.2 Principes d'interface

- **Mobile-first :** Conçu pour un écran de téléphone tenu verticalement
- **Gros boutons :** Zone de tap minimum 48×48px, pavé numérique avec touches de 60×60px minimum
- **Pas de chrono visible :** Le temps est mesuré en arrière-plan mais jamais montré à l'enfant (éviter l'anxiété)
- **Palette éditoriale cream/indigo :** fond cream (`#FBF6EC`), indigo pour les éléments principaux, accents coral / sage / honey. Pas de couleurs agressives, mode clair uniquement.
- **Typographie :** paire **Fraunces** (serif éditorial pour les titres) + **Nunito** (sans-serif pour le corps de texte et les éléments UI). Choisie pour donner une signature graphique distinctive sans sacrifier la lisibilité.
- **Encouragements systématiques :** Aucun message négatif. Les erreurs sont traitées comme des opportunités d'apprentissage
- **Feedback orienté progrès, pas performance :** L'application ne montre jamais de score brut (ex : "8/12") ni de note à l'enfant. Les métriques visibles sont orientées vers la maîtrise et le progrès (faits appris, faits promus, progression globale). Ce choix s'appuie sur Butler (1988) et Hattie & Timperley (2007), qui montrent que le feedback de type "note/score" (ego-involving) réduit la motivation intrinsèque et les performances par rapport au feedback orienté processus/progrès (task-involving). Le score brut est réservé au tableau de bord parent (§5.2).
- **Pas de publicité, pas d'intégration tierce de tracking.** Les seuls liens sortants côté enfant sont inexistants. Côté parent, le tableau de bord peut ouvrir le guide utilisateur interne (même origine) dans un nouvel onglet, et le formulaire « Envoyer un avis » pousse sur Supabase — il n'y a aucun lien vers un service externe visible pour l'enfant.

### 7.3 Sons

- Réponse correcte : son court et joyeux (type xylophone montant)
- Réponse incorrecte : son neutre et doux (pas de buzzer)
- Badge obtenu : fanfare courte
- Image mystère complétée (tous les faits en boîte 5) : mélodie de complétion
- **Option de couper le son** toujours accessible

---

## 8. Fonctionnalités PWA / hors-ligne

- **Service Worker** pour le fonctionnement offline complet
- **manifest.json** pour l'installation sur l'écran d'accueil
- Icône d'app avec la mascotte
- Toutes les données en localStorage, aucune dépendance réseau
- Export/import JSON pour la sauvegarde et le transfert

---

## 9. Périmètre — Ce que l'application ne fait PAS

- Pas de division, addition ou soustraction (focus unique)
- Pas de comptes utilisateurs / backend / authentification
- Pas de classement entre enfants (pas de compétition)
- Pas de mode examen chronométré
- Pas de récompenses payantes
- Pas de collecte de données personnelles

---

## 10. Métriques de succès

L'application est considérée comme ayant atteint son objectif quand :

| Métrique | Cible |
|----------|-------|
| Faits en boîte 4+ | 36/36 |
| Temps de réponse moyen | < 3 secondes |
| Taux de bonne réponse (boîte 4+) | > 95% |
| Durée estimée pour atteindre l'objectif | 6-10 semaines à raison de 5 séances/semaine |

---

## 11. Évolutions possibles (V2)

- Extension aux tables de 11 et 12
- Mode défi : séance bonus optionnelle le week-end
- Personnalisation de la mascotte (couleurs, accessoires choisis par l'enfant — sans logique de déblocage, pour ne pas réintroduire une couche de progression parasite)
- Intégration Strava-like : partage de la streak avec un parent
- Mode multi-enfant (plusieurs profils sur le même appareil)
- Lien division : une fois un fait maîtrisé en multiplication, introduction du fait de division associé

---

## 12. Références

- Brendefur, J., Strother, S., Thiede, K., & Appleton, S. (2015). Developing multiplication fact fluency. *Advances in Social Sciences Research Journal, 2*(8). [doi:10.14738/assrj.28.1396](https://doi.org/10.14738/assrj.28.1396)

- Burns, M. K., Kanive, R., & DeGrande, M. (2012). Effect of a computer-delivered math fact intervention as a supplemental intervention for math in third and fourth grades. *Remedial and Special Education, 33*(3), 184–191. [doi:10.1177/0741932510381652](https://doi.org/10.1177/0741932510381652)

- Butler, R. (1988). Enhancing and undermining intrinsic motivation: The effects of task-involving and ego-involving evaluation on interest and performance. *British Journal of Educational Psychology, 58*(1), 1–14. [doi:10.1111/j.2044-8279.1988.tb00874.x](https://doi.org/10.1111/j.2044-8279.1988.tb00874.x)

- Cepeda, N. J., Vul, E., Rohrer, D., Wixted, J. T., & Pashler, H. (2008). Spacing effects in learning: A temporal ridgeline of optimal retention. *Psychological Science, 19*(11), 1095–1102. [doi:10.1111/j.1467-9280.2008.02209.x](https://doi.org/10.1111/j.1467-9280.2008.02209.x)

- Codding, R. S., Burns, M. K., & Lukito, G. (2011). Meta-analysis of mathematic basic-fact fluency interventions: A component analysis. *Learning Disabilities Research & Practice, 26*(1), 36–47. [doi:10.1111/j.1540-5826.2010.00323.x](https://doi.org/10.1111/j.1540-5826.2010.00323.x)

- Cowan, R., Donlan, C., Shepherd, D.-L., Cole-Fletcher, R., Saxton, M., & Hurry, J. (2011). Basic calculation proficiency and mathematics achievement in elementary school children. *Journal of Educational Psychology, 103*(4), 786–803. [doi:10.1037/a0024556](https://doi.org/10.1037/a0024556)

- Dotan, D., & Zviran-Ginat, S. (2022). Elementary math in elementary school: The effect of interference on learning the multiplication table. *Cognitive Research: Principles and Implications, 7*, 101. [doi:10.1186/s41235-022-00451-0](https://doi.org/10.1186/s41235-022-00451-0)

- Hattie, J., & Timperley, H. (2007). The power of feedback. *Review of Educational Research, 77*(1), 81–112. [doi:10.3102/003465430298487](https://doi.org/10.3102/003465430298487)

- Kang, S. H. K. (2016). Spaced repetition promotes efficient and effective learning. *Policy Insights from the Behavioral and Brain Sciences, 3*(1), 12–19. [doi:10.1177/2372732215624708](https://doi.org/10.1177/2372732215624708)

- Rea, C. P., & Modigliani, V. (1985). The effect of expanded versus massed practice on the retention of multiplication facts and spelling lists. *Human Learning, 4*, 11–18.

- Rohrer, D., Dedrick, R. F., & Burgess, K. (2014). The benefit of interleaved mathematics practice is not limited to superficially similar kinds of problems. *Psychonomic Bulletin & Review, 21*(5), 1323–1330. [doi:10.3758/s13423-014-0588-3](https://doi.org/10.3758/s13423-014-0588-3)

- Rohrer, D., & Taylor, K. (2007). The shuffling of mathematics problems improves learning. *Instructional Science, 35*, 481–498. [doi:10.1007/s11251-007-9015-8](https://doi.org/10.1007/s11251-007-9015-8)

---

*Document de spécifications — v1.0 — Avril 2026*
