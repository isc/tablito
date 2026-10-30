# Un enfant, deux appareils — note de conception

30 octobre 2026. Étude seulement : aucun code applicatif.

## Ce qui existe (vérifié dans le code)

- Le profil vit dans le localStorage d'un appareil (`multiplix-profile:<id>`, `src/lib/storage.ts`).
- Le transfert (`src/lib/transfer.ts`) copie le profil une fois (lecture unique, 15 min). Ensuite
  les copies divergent, et un second transfert écrase la cible : `installProfile` fait `saveProfile`
  dès qu'il trouve le même prénom et la même date de début.
- Le suivi (`src/lib/watch.ts`, table `watches`) : après chaque séance, l'appareil de l'enfant dépose
  un instantané chiffré (`publishWatchSnapshot`, appelé en fin de séance dans `App.tsx`).
  `publish_watch` écrase la ligne sans condition. Le parent ne fait que lire. Supprimer le profil
  révoque le dépôt (`handleDeleteProfile` → `stopWatch`).
- Deux points qui aident : `todayISO()` est en UTC, donc deux appareils comptent les mêmes jours ;
  et la série se calcule par des fonctions pures (`settleStreak`, `applyStreakUpdate`) qu'on peut rejouer.
- Taille : un profil au maximum (5 matières, 30 tentatives par fait, 50 séances) pèse ~0,9 Mo en JSON,
  ~110 Ko une fois gzippé et chiffré. La limite de `publish_watch` est de 1 Mo.

## Options

| | Principe | Deux séances hors ligne | Effort |
|---|---|---|---|
| A. Statu quo | un appareil joue, les autres suivent (+ « Installer ici », #126) | — | 0 |
| B. Le dernier qui écrit gagne | relecture avant la séance, dépôt après, profil entier ; en cas de conflit le parent choisit une copie | une séance perdue | ~2,5 j |
| **C. Fusion par fait** | relecture, fusion, dépôt ; fusion à trois voies | rien de perdu | ~5–6 j (minimum ~4 j) |
| D. Comptes et serveur | l'état vit côté serveur | — | 2–3 sem., contraire au « sans backend » et au chiffrement de bout en bout |

B est fragile justement dans le cas qui pose problème : un téléphone confié à l'enfant en mode avion
joue sur une copie périmée, et le parent doit ensuite choisir quelle séance jeter.

## Recommandation : C

### Le canal

- **Même table, mêmes RPC, même chiffrement que le suivi**, et même code + clé : les appareils qui
  jouent et ceux qui suivent lisent le même dépôt. Le contenu reste le profil JSON : les suiveurs
  actuels le lisent sans rien changer.
- Une RPC de plus, `publish_watch_if(code, payload, updated_at attendu)` : elle n'écrit que si la
  ligne n'a pas bougé depuis la relecture. Sinon l'appareil relit, refusionne et réessaie.
  `publish_watch` reste pour les clients encore en cache.
- **Base de la fusion** : chaque appareil garde le dernier dépôt qu'il a fusionné
  (`multiplix-sync-base:<id>`, le blob chiffré, ≤ ~110 Ko). C'est elle qui dit « qui a changé quoi ».
- **Quand** : relecture au démarrage, au retour au premier plan et au tap « C'est parti » (2 s au plus,
  sinon la séance part sur l'état local) ; dépôt en fin de séance, à l'arrêt par le ×, et au retour du
  réseau s'il en reste un en attente. La fusion ne s'applique que sur l'accueil, comme le
  rechargement du service worker (`setBusy`), jamais en pleine séance.
- Un champ `syncFormat` : un appareil qui reçoit un format plus récent que le sien ne fusionne pas et
  attend sa mise à jour. Les champs qu'il ne connaît pas sont recopiés tels quels.

### Les règles de fusion

Ce qui n'a changé que d'un côté depuis la base est pris de ce côté. Pour ce qui a changé des deux côtés :

- **Faits Leitner** (×, ÷, reste, conjugaison, irréguliers), fait par fait : l'historique est l'union
  des tentatives, sans doublon, 30 dernières. L'état retenu est celui de la **boîte la plus basse**
  (échéance la plus proche). Une erreur n'est jamais effacée, et au pire le fait revient une fois de
  plus. Rejouer les tentatives est impossible : elles n'ont que la date, ni l'heure ni le mode de
  saisie qui fixe le seuil de rapidité. `introduced` : vrai d'un côté suffit ; `introducedAt` : le
  plus ancien ; `seen` : le max. `conjFacts`/`irrFacts` absents d'un côté : on prend l'autre.
- **Historique des séances** : union, triée, 50 dernières. Chaque nouvelle séance reçoit un
  identifiant pour le dédoublonnage ; les anciennes se comparent au contenu.
- **`totalSessions`** = local + distant − base.
- **Série et gels** : on rejoue, depuis l'état de la base, les jours joués des deux côtés
  (`applyStreakUpdate`), puis `settleStreak` jusqu'à aujourd'hui. `longestStreak` : le max. Dates de
  séance par matière : la plus récente.
- **Badges** : union par id, date la plus ancienne, puis `checkBadges` pour les badges d'état.
- **Drapeaux** (`hasSeen*`, `hasDone*Placement`) : vrai d'un côté suffit. **Thèmes d'image mystère** :
  la valeur déjà déposée gagne, sinon deux appareils pourraient tirer deux images différentes au
  remplissage des champs manquants. Prénom, verbes « vus en classe » : le plus récent.

### Deux séances hors ligne, concrètement

Base : 7×8 en boîte 3, série de 12, 40 séances. Samedi, appareil A en mode avion : 7×8 juste et rapide,
boîte 4. Dimanche, appareil B, qui n'a pas reçu samedi : 7×8 faux, boîte 1, et B croit samedi manqué,
donc consomme un gel.

Après fusion : 7×8 en boîte 1 (l'erreur gagne) avec les deux tentatives ; 42 séances ; samedi et
dimanche joués, donc série de 14 et le gel de B rendu ; les badges des deux côtés. Rien n'est perdu.
Seul défaut visible : B a annoncé « gel utilisé » à tort ce dimanche-là.

Le même jour sur les deux appareils, la série ne compte qu'une fois. La séance du jour peut être faite
deux fois, sans dommage.

### L'appairage

- **Un seul QR côté enfant** : « Ajouter un appareil ». C'est l'appareil qui scanne qui demande :
  « Faire jouer Léa ici aussi (sa progression se synchronise) » ou « Suivre seulement ». Le bouton
  « Installer la progression ici » de #126 devient « Faire jouer Léa ici aussi » : une synchro au lieu
  d'une copie qui diverge. Le fragment reste `#watch=`, donc rien à changer au script inline de
  `index.html`.
- **Identité** : un `childId` stable dans le profil (aujourd'hui : prénom + date de début). Si
  l'appareil a déjà une copie (ancien transfert), fusion sans base : par fait (l'historique qui contient
  l'autre gagne, sinon la boîte la plus basse), compteurs au max, série du côté le plus récent. On
  propose d'abord d'exporter une sauvegarde.
- **Confusion des QR** : tous les scanners, et l'ouverture d'un lien au démarrage, reconnaissent
  `#transfer=` et `#watch=` et disent en une phrase ce qui va se passer avant d'agir. À terme,
  « Changer d'appareil » = « Ajouter un appareil » puis « Retirer Léa de ce téléphone » ; on peut garder
  le transfert en attendant.
- **Retrait** : « Retirer Léa de ce téléphone » oublie localement sans révoquer ; « Ne plus partager »
  révoque partout. Aujourd'hui, supprimer le profil révoque le dépôt : à changer, sinon supprimer Léa
  du téléphone de papa coupe la synchro de maman.

### Rappels push et recap du dimanche

- **Rappel quotidien** : l'anti-relance est par souscription (`last_session_date`). Le téléphone B
  relancerait donc à 18 h alors que l'enfant a joué sur A. Correctif : une colonne `sync_group`
  (empreinte du code) sur `push_subscriptions`, `mark_reminder_session` marque tout le groupe, et le
  cron saute le rappel si le groupe a joué aujourd'hui (~0,5 j). Sans ça : un rappel en trop sur
  l'appareil qui n'a pas servi.
- **Recap du dimanche** : rien ne change pour les suiveurs, qui lisent un dépôt désormais fusionné,
  donc plus complet. À ajouter : proposer l'interrupteur aussi sur un appareil qui joue un profil
  synchronisé (aujourd'hui il n'apparaît que si l'appareil suit un enfant).

### Confidentialité et risques

- **La clé** : inchangé. Elle vit dans le fragment et le localStorage, jamais au serveur, qui ne voit
  que le code, un blob opaque et l'heure du dépôt. Nouvelle métadonnée : `sync_group` relie les
  souscriptions push d'une même famille, sans rien dire de leur contenu.
- **L'intégrité, le vrai changement.** Aujourd'hui, qui détient le lien peut écraser l'instantané :
  un effet cosmétique, effacé à la séance suivante. Demain, ce qu'il dépose est fusionné dans le vrai
  profil, et la fusion est cumulative (une tentative ou un badge déposé ne s'efface plus). Le modèle
  de confiance devient « qui a le lien, c'est la famille ». Si Ivan veut que les suiveurs ne puissent
  pas écrire : un code de synchro distinct du code de suivi (+0,5 j, mais deux QR à nouveau).
- **Un bug de fusion se propage à tous les appareils.** Parades : fusion en fonction pure, tests de
  propriétés (idempotente, commutative, ne perd jamais une tentative), copie locale du profil
  d'avant chaque fusion.
- **Versions mélangées** : un appareil resté sur l'ancien code dépose sans fusionner. La fusion à
  trois voies le rattrape sans rien perdre ; il ne reçoit les séances de l'autre qu'une fois à jour.
- **Ordre de déploiement** : le SQL (nouvelle RPC, colonne push) s'applique à la main avant le client,
  comme pour `push_subscriptions.sql`.
- Effet de bord utile : chaque appareil devient la sauvegarde de l'autre.

## Effort

| Lot | Effort |
|---|---|
| Fusion (fonction pure) et ses tests | 1,5–2 j |
| Relecture/fusion/dépôt, base, RPC conditionnelle, application sur l'accueil | 1–1,5 j |
| Appairage : QR unique, choix du rôle, scanners, retrait local ou révocation, FR/EN | 1–1,5 j |
| Rappel par groupe (SQL, cron, client) | 0,5 j |
| Specs §14, changelog, test d'intégration (le helper `watchServer` existe) | 0,5–1 j |
| **Total** | **~5–6 j** ; minimum sans rappel par groupe ni fusion de copies déjà divergées : ~4 j |
