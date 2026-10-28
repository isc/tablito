// Service Worker minimal.
//
// Stratégie :
//  - install : precache du shell (HTML, JS, CSS, vendor, icônes — pas
//    les médias lourds qui sont chargés à la demande), relu frais hors de
//    tout cache (cf. precache), puis skipWaiting()
//    pour activer immédiatement. La protection "ne pas reloader pendant
//    une séance" est gérée page-side (pwa-register.js diffère le reload
//    tant que `busy=true`).
//  - activate : suppression des caches périmés + clients.claim(), pour
//    que les pages déjà ouvertes reçoivent un `controllerchange` (qui
//    déclenche le reload côté page).
//  - navigation : cache-first sur le shell `index.html` (cold launch
//    instantané, plus aucune attente réseau pour ouvrir l'app). Le
//    fallback réseau couvre uniquement le cas pathologique où le shell
//    n'est pas dans le cache (1re install pas terminée).
//  - autre GET : cache-first puis lazy-cache si succès réseau.
//
// Les caches sont séparés par cycle de vie. Le shell est versionné par build
// (son contenu doit changer à chaque déploiement) ; les médias lazy (MP3,
// images mystère, splash…) ont leur propre cache versionné par leur CONTENU,
// calculé au build. Avant, tout partageait le cache versionné par build : le
// `activate` d'une nouvelle version jetait aussi les ~13 Mo d'images mystère et
// les ~55 Mo de MP3 déjà téléchargés, qui repartaient sur le réseau au premier
// usage — d'autant plus visible que GitHub Pages sert ces fichiers en
// `max-age=600`, donc sans filet côté cache HTTP.
//
// Historique : avant, le SW attendait un message SKIP_WAITING du page-side
// pour skipWaiting. Ça dépendait d'un `pwa-register.js` qui s'exécutait
// correctement. Si pour une raison X le page-side ne pouvait pas envoyer
// le message (bug, ancienne version cachée), les SWs s'accumulaient en
// `waiting` indéfiniment et aucune mise à jour ne se propageait. Le fait
// que la décision soit prise SW-side la rend robuste à n'importe quel
// état dégradé du code page.
//
// Les marqueurs de version, de base path et de liste d'assets sont
// substitués par scripts/build.mjs.

const VERSION = "20261028080352"
const CACHE = 'tablito-' + VERSION
const BASE = "/previews/accueil-tuiles-alignees/"
const ASSETS = [
  "/previews/accueil-tuiles-alignees/favicon.svg",
  "/previews/accueil-tuiles-alignees/fonts/fonts.css",
  "/previews/accueil-tuiles-alignees/fonts/fraunces-italic-eQ7ZXk8g.woff2",
  "/previews/accueil-tuiles-alignees/fonts/fraunces-normal-TeP2Xz5c.woff2",
  "/previews/accueil-tuiles-alignees/fonts/jetbrains-mono-normal-k6OThhvA.woff2",
  "/previews/accueil-tuiles-alignees/fonts/nunito-normal-aBTMnFcQ.woff2",
  "/previews/accueil-tuiles-alignees/icons/apple-touch-icon.png",
  "/previews/accueil-tuiles-alignees/icons/icon-192.png",
  "/previews/accueil-tuiles-alignees/icons/icon-512.png",
  "/previews/accueil-tuiles-alignees/icons/icon.svg",
  "/previews/accueil-tuiles-alignees/index.html",
  "/previews/accueil-tuiles-alignees/manifest.en.webmanifest",
  "/previews/accueil-tuiles-alignees/manifest.webmanifest",
  "/previews/accueil-tuiles-alignees/pwa-register.js",
  "/previews/accueil-tuiles-alignees/src/App.js",
  "/previews/accueil-tuiles-alignees/src/components/ActivityStrip.js",
  "/previews/accueil-tuiles-alignees/src/components/BackChevron.js",
  "/previews/accueil-tuiles-alignees/src/components/Badge.js",
  "/previews/accueil-tuiles-alignees/src/components/BadgeDetailModal.js",
  "/previews/accueil-tuiles-alignees/src/components/ConjFeedbackOverlay.js",
  "/previews/accueil-tuiles-alignees/src/components/ConjForm.js",
  "/previews/accueil-tuiles-alignees/src/components/ConjMysteryImage.js",
  "/previews/accueil-tuiles-alignees/src/components/ConjProgressGrid.js",
  "/previews/accueil-tuiles-alignees/src/components/ConjQuestionPrompt.js",
  "/previews/accueil-tuiles-alignees/src/components/ConjRuleListenButton.js",
  "/previews/accueil-tuiles-alignees/src/components/ConjRuleVisual.js",
  "/previews/accueil-tuiles-alignees/src/components/ConjVoiceInput.js",
  "/previews/accueil-tuiles-alignees/src/components/DivisionMysteryImage.js",
  "/previews/accueil-tuiles-alignees/src/components/DivisionProgressGrid.js",
  "/previews/accueil-tuiles-alignees/src/components/DivisionStrategyHint.js",
  "/previews/accueil-tuiles-alignees/src/components/DotGrid.js",
  "/previews/accueil-tuiles-alignees/src/components/ErrorBoundary.js",
  "/previews/accueil-tuiles-alignees/src/components/EvolutionChart.js",
  "/previews/accueil-tuiles-alignees/src/components/Feather.js",
  "/previews/accueil-tuiles-alignees/src/components/FeedbackModal.js",
  "/previews/accueil-tuiles-alignees/src/components/FeedbackOverlay.js",
  "/previews/accueil-tuiles-alignees/src/components/FeedbackStar.js",
  "/previews/accueil-tuiles-alignees/src/components/FlameIcon.js",
  "/previews/accueil-tuiles-alignees/src/components/IrrAnswerInput.js",
  "/previews/accueil-tuiles-alignees/src/components/IrrClassVerbs.js",
  "/previews/accueil-tuiles-alignees/src/components/IrrFeedbackOverlay.js",
  "/previews/accueil-tuiles-alignees/src/components/IrrForms.js",
  "/previews/accueil-tuiles-alignees/src/components/IrrIntro.js",
  "/previews/accueil-tuiles-alignees/src/components/IrrMysteryImage.js",
  "/previews/accueil-tuiles-alignees/src/components/IrrProgressGrid.js",
  "/previews/accueil-tuiles-alignees/src/components/IrrVoiceInput.js",
  "/previews/accueil-tuiles-alignees/src/components/LanguageToggle.js",
  "/previews/accueil-tuiles-alignees/src/components/LeitnerGrid.js",
  "/previews/accueil-tuiles-alignees/src/components/LetterKeyboard.js",
  "/previews/accueil-tuiles-alignees/src/components/ListenButton.js",
  "/previews/accueil-tuiles-alignees/src/components/Mascot.js",
  "/previews/accueil-tuiles-alignees/src/components/Modal.js",
  "/previews/accueil-tuiles-alignees/src/components/MysteryGrid.js",
  "/previews/accueil-tuiles-alignees/src/components/MysteryImage.js",
  "/previews/accueil-tuiles-alignees/src/components/NumPad.js",
  "/previews/accueil-tuiles-alignees/src/components/ParentBoxChart.js",
  "/previews/accueil-tuiles-alignees/src/components/ParentChildPicker.js",
  "/previews/accueil-tuiles-alignees/src/components/ParentFeedbackButton.js",
  "/previews/accueil-tuiles-alignees/src/components/ParentGate.js",
  "/previews/accueil-tuiles-alignees/src/components/ParentHardFacts.js",
  "/previews/accueil-tuiles-alignees/src/components/ParentHelpPage.js",
  "/previews/accueil-tuiles-alignees/src/components/ParentHomeIdea.js",
  "/previews/accueil-tuiles-alignees/src/components/ParentMastery.js",
  "/previews/accueil-tuiles-alignees/src/components/ParentOverview.js",
  "/previews/accueil-tuiles-alignees/src/components/ParentProfilesPage.js",
  "/previews/accueil-tuiles-alignees/src/components/ParentQrPanel.js",
  "/previews/accueil-tuiles-alignees/src/components/ParentSegmented.js",
  "/previews/accueil-tuiles-alignees/src/components/ParentSettingIcons.js",
  "/previews/accueil-tuiles-alignees/src/components/ParentSettingRow.js",
  "/previews/accueil-tuiles-alignees/src/components/ParentSettingsList.js",
  "/previews/accueil-tuiles-alignees/src/components/ParentSubjectDetail.js",
  "/previews/accueil-tuiles-alignees/src/components/ParentWatchPage.js",
  "/previews/accueil-tuiles-alignees/src/components/ParentWatchPairing.js",
  "/previews/accueil-tuiles-alignees/src/components/ParentWeekCard.js",
  "/previews/accueil-tuiles-alignees/src/components/ProfileAvatar.js",
  "/previews/accueil-tuiles-alignees/src/components/ProgressGrid.js",
  "/previews/accueil-tuiles-alignees/src/components/PushPrefRow.js",
  "/previews/accueil-tuiles-alignees/src/components/QrCanvas.js",
  "/previews/accueil-tuiles-alignees/src/components/RemainderMysteryImage.js",
  "/previews/accueil-tuiles-alignees/src/components/RemainderProgressGrid.js",
  "/previews/accueil-tuiles-alignees/src/components/RemainderStrategyHint.js",
  "/previews/accueil-tuiles-alignees/src/components/StrategyHint.js",
  "/previews/accueil-tuiles-alignees/src/components/StrategyHintShell.js",
  "/previews/accueil-tuiles-alignees/src/components/StreakDetailModal.js",
  "/previews/accueil-tuiles-alignees/src/components/VoiceInput.js",
  "/previews/accueil-tuiles-alignees/src/components/conjHintLine.js",
  "/previews/accueil-tuiles-alignees/src/hooks/useBackGesture.js",
  "/previews/accueil-tuiles-alignees/src/hooks/useConfetti.js",
  "/previews/accueil-tuiles-alignees/src/hooks/useCopyFeedback.js",
  "/previews/accueil-tuiles-alignees/src/hooks/useInputMode.js",
  "/previews/accueil-tuiles-alignees/src/hooks/useLatestRef.js",
  "/previews/accueil-tuiles-alignees/src/hooks/usePushPref.js",
  "/previews/accueil-tuiles-alignees/src/hooks/useQrScan.js",
  "/previews/accueil-tuiles-alignees/src/hooks/useSound.js",
  "/previews/accueil-tuiles-alignees/src/hooks/useSpeechRecognition.js",
  "/previews/accueil-tuiles-alignees/src/hooks/useTTS.js",
  "/previews/accueil-tuiles-alignees/src/hooks/useWakeLock.js",
  "/previews/accueil-tuiles-alignees/src/i18n/LangProvider.js",
  "/previews/accueil-tuiles-alignees/src/i18n/app.js",
  "/previews/accueil-tuiles-alignees/src/i18n/badges.js",
  "/previews/accueil-tuiles-alignees/src/i18n/changelog.js",
  "/previews/accueil-tuiles-alignees/src/i18n/conjugation.js",
  "/previews/accueil-tuiles-alignees/src/i18n/home.js",
  "/previews/accueil-tuiles-alignees/src/i18n/homeIdea.js",
  "/previews/accueil-tuiles-alignees/src/i18n/irregular.js",
  "/previews/accueil-tuiles-alignees/src/i18n/lang.js",
  "/previews/accueil-tuiles-alignees/src/i18n/language.js",
  "/previews/accueil-tuiles-alignees/src/i18n/onboarding.js",
  "/previews/accueil-tuiles-alignees/src/i18n/parent.js",
  "/previews/accueil-tuiles-alignees/src/i18n/parentGate.js",
  "/previews/accueil-tuiles-alignees/src/i18n/privacy.js",
  "/previews/accueil-tuiles-alignees/src/i18n/progress.js",
  "/previews/accueil-tuiles-alignees/src/i18n/recap.js",
  "/previews/accueil-tuiles-alignees/src/i18n/session.js",
  "/previews/accueil-tuiles-alignees/src/i18n/strategies.js",
  "/previews/accueil-tuiles-alignees/src/i18n/tense.js",
  "/previews/accueil-tuiles-alignees/src/i18n/voice.js",
  "/previews/accueil-tuiles-alignees/src/i18n/week.js",
  "/previews/accueil-tuiles-alignees/src/lib/activity.js",
  "/previews/accueil-tuiles-alignees/src/lib/audioContext.js",
  "/previews/accueil-tuiles-alignees/src/lib/badges.js",
  "/previews/accueil-tuiles-alignees/src/lib/changelog.js",
  "/previews/accueil-tuiles-alignees/src/lib/codec.js",
  "/previews/accueil-tuiles-alignees/src/lib/conjugationComposer.js",
  "/previews/accueil-tuiles-alignees/src/lib/conjugationFacts.js",
  "/previews/accueil-tuiles-alignees/src/lib/conjugationInterference.js",
  "/previews/accueil-tuiles-alignees/src/lib/conjugationPlacement.js",
  "/previews/accueil-tuiles-alignees/src/lib/conjugationRules.js",
  "/previews/accueil-tuiles-alignees/src/lib/conjugationStrategies.js",
  "/previews/accueil-tuiles-alignees/src/lib/dailyComposer.js",
  "/previews/accueil-tuiles-alignees/src/lib/debugTools.js",
  "/previews/accueil-tuiles-alignees/src/lib/divisionComposer.js",
  "/previews/accueil-tuiles-alignees/src/lib/divisionFacts.js",
  "/previews/accueil-tuiles-alignees/src/lib/divisionStrategies.js",
  "/previews/accueil-tuiles-alignees/src/lib/facts.js",
  "/previews/accueil-tuiles-alignees/src/lib/feedback.js",
  "/previews/accueil-tuiles-alignees/src/lib/hardestFacts.js",
  "/previews/accueil-tuiles-alignees/src/lib/homeIdea.js",
  "/previews/accueil-tuiles-alignees/src/lib/install.js",
  "/previews/accueil-tuiles-alignees/src/lib/irregularComposer.js",
  "/previews/accueil-tuiles-alignees/src/lib/irregularPlacement.js",
  "/previews/accueil-tuiles-alignees/src/lib/irregularVerbs.js",
  "/previews/accueil-tuiles-alignees/src/lib/leitner.js",
  "/previews/accueil-tuiles-alignees/src/lib/letterNames.js",
  "/previews/accueil-tuiles-alignees/src/lib/micPreflight.js",
  "/previews/accueil-tuiles-alignees/src/lib/parseEnglishNumber.js",
  "/previews/accueil-tuiles-alignees/src/lib/parseFrenchNumber.js",
  "/previews/accueil-tuiles-alignees/src/lib/parseSpelledLetters.js",
  "/previews/accueil-tuiles-alignees/src/lib/parseSpokenIrregular.js",
  "/previews/accueil-tuiles-alignees/src/lib/parseSpokenNumber.js",
  "/previews/accueil-tuiles-alignees/src/lib/parseSpokenRemainder.js",
  "/previews/accueil-tuiles-alignees/src/lib/phoneticDict.js",
  "/previews/accueil-tuiles-alignees/src/lib/placement.js",
  "/previews/accueil-tuiles-alignees/src/lib/push.js",
  "/previews/accueil-tuiles-alignees/src/lib/questionClock.js",
  "/previews/accueil-tuiles-alignees/src/lib/remainderComposer.js",
  "/previews/accueil-tuiles-alignees/src/lib/remainderFacts.js",
  "/previews/accueil-tuiles-alignees/src/lib/remainderStrategies.js",
  "/previews/accueil-tuiles-alignees/src/lib/sessionComposer.js",
  "/previews/accueil-tuiles-alignees/src/lib/sessionItemView.js",
  "/previews/accueil-tuiles-alignees/src/lib/sessionTiming.js",
  "/previews/accueil-tuiles-alignees/src/lib/similarity.js",
  "/previews/accueil-tuiles-alignees/src/lib/spokenNumber.js",
  "/previews/accueil-tuiles-alignees/src/lib/storage.js",
  "/previews/accueil-tuiles-alignees/src/lib/strategies.js",
  "/previews/accueil-tuiles-alignees/src/lib/streak.js",
  "/previews/accueil-tuiles-alignees/src/lib/supabase.js",
  "/previews/accueil-tuiles-alignees/src/lib/transfer.js",
  "/previews/accueil-tuiles-alignees/src/lib/utils.js",
  "/previews/accueil-tuiles-alignees/src/lib/version.js",
  "/previews/accueil-tuiles-alignees/src/lib/voiceDebug.js",
  "/previews/accueil-tuiles-alignees/src/lib/watch.js",
  "/previews/accueil-tuiles-alignees/src/lib/watchStore.js",
  "/previews/accueil-tuiles-alignees/src/lib/weekSummary.js",
  "/previews/accueil-tuiles-alignees/src/main.js",
  "/previews/accueil-tuiles-alignees/src/screens/BadgesScreen.js",
  "/previews/accueil-tuiles-alignees/src/screens/ChangelogScreen.js",
  "/previews/accueil-tuiles-alignees/src/screens/ConjPlacementScreen.js",
  "/previews/accueil-tuiles-alignees/src/screens/HomeScreen.js",
  "/previews/accueil-tuiles-alignees/src/screens/IrrPlacementScreen.js",
  "/previews/accueil-tuiles-alignees/src/screens/ParentDashboard.js",
  "/previews/accueil-tuiles-alignees/src/screens/PrivacyScreen.js",
  "/previews/accueil-tuiles-alignees/src/screens/ProfileSelectScreen.js",
  "/previews/accueil-tuiles-alignees/src/screens/ProgressScreen.js",
  "/previews/accueil-tuiles-alignees/src/screens/RecapScreen.js",
  "/previews/accueil-tuiles-alignees/src/screens/RulesIntroScreen.js",
  "/previews/accueil-tuiles-alignees/src/screens/RulesScreen.js",
  "/previews/accueil-tuiles-alignees/src/screens/SessionScreen.js",
  "/previews/accueil-tuiles-alignees/src/screens/WelcomeScreen.js",
  "/previews/accueil-tuiles-alignees/src/types.js",
  "/previews/accueil-tuiles-alignees/styles.css",
  "/previews/accueil-tuiles-alignees/vendor/preact/compat-client.mjs",
  "/previews/accueil-tuiles-alignees/vendor/preact/compat.module.js",
  "/previews/accueil-tuiles-alignees/vendor/preact/hooks.module.js",
  "/previews/accueil-tuiles-alignees/vendor/preact/jsx-runtime.module.js",
  "/previews/accueil-tuiles-alignees/vendor/preact/preact.module.js"
]

// { groupe: [préfixes d'URL] } et { groupe: hash du contenu } — cf. LAZY_GROUPS
// dans scripts/build.mjs, qui est la source unique de la liste.
const LAZY_GROUPS = {"audio":["/previews/accueil-tuiles-alignees/audio/"],"media":["/previews/accueil-tuiles-alignees/mystery/"],"splash":["/previews/accueil-tuiles-alignees/splash/"],"landing":["/previews/accueil-tuiles-alignees/video/","/previews/accueil-tuiles-alignees/img/hero-poster"],"qrscan":["/previews/accueil-tuiles-alignees/vendor/qr-scanner/"],"phonetic":["/previews/accueil-tuiles-alignees/phonetic/"],"qrgen":["/previews/accueil-tuiles-alignees/vendor/lean-qr/"]}
const LAZY_VERSIONS = {"audio":"fbe0825f6b76","media":"451f226cdafa","splash":"7cd2da5fda63","landing":"ece39f6d51b0","qrscan":"1ddb9a3148cc","phonetic":"fa4ee22f5b55","qrgen":"6c1f3275c362"}

// cf. STANDALONE_DOCS dans scripts/cache-config.mjs (source unique).
const STANDALONE_DOCS = ["/guide/","/specs/","/previews/"]

const LAZY_CACHES = {}
for (const group of Object.keys(LAZY_GROUPS)) {
  LAZY_CACHES[group] = 'tablito-' + group + '-' + LAZY_VERSIONS[group]
}
const KEEP = [CACHE].concat(Object.values(LAZY_CACHES))

// Cache d'écriture d'une réponse lazy-cachée. Tout ce qui n'est pas un média
// (pages du guide, specs…) retombe sur le cache shell, donc suit le cycle de vie
// des déploiements comme avant.
function cacheNameFor(pathname) {
  for (const group of Object.keys(LAZY_GROUPS)) {
    if (LAZY_GROUPS[group].some((p) => pathname.startsWith(p))) return LAZY_CACHES[group]
  }
  return CACHE
}

// Précache tolérant aux échecs. `cache.addAll()` est ATOMIQUE : un seul asset
// qui échoue à se télécharger (fréquent sur WiFi faible — l'environnement où le
// cache offline est justement le plus utile) rejette TOUT le précache, l'install
// échoue, et l'appareil reste sans cache pour cette version. On cache donc asset
// par asset : ce qui passe est gardé, le reste sera lazy-caché à la 1re requête
// réseau réussie (cf. fetch handler). L'install réussit toujours.
//
// Chaque fichier est relu FRAIS : la version dans l'URL (et `no-store`)
// court-circuite le cache HTTP du navigateur et le CDN de GitHub Pages, qui
// servent tout en max-age=600. Sans ça, un appareil mis à jour dans les minutes
// qui suivaient un déploiement rangeait les ANCIENNES copies sous le nom du
// nouveau cache, et restait figé sur la version d'avant jusqu'au déploiement
// suivant : son SW étant à jour, plus rien ne revérifiait ces fichiers (vécu le
// 03/10/2026). La réponse est recopiée pour être rangée et servie sous son URL
// propre, sans la version.
function precache() {
  return caches.open(CACHE).then((c) =>
    Promise.allSettled(ASSETS.map((a) =>
      fetch(a + '?v=' + VERSION, { cache: 'no-store' }).then((res) => {
        if (!res.ok) throw new Error(a + ' : ' + res.status)
        return c.put(a, new Response(res.body, res))
      })
    ))
  )
}

self.addEventListener('install', (e) => {
  e.waitUntil(precache().then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => KEEP.indexOf(k) === -1).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)
  if (url.origin !== self.location.origin) return

  // Navigation : cache-first sur le shell. Sert le `index.html` précaché
  // sans toucher au réseau → cold launch instantané. Les nouvelles versions
  // arrivent par le mécanisme SW (cf. pwa-register.js).
  // Exceptions (équivalent du navigateFallbackDenylist VitePWA) : le guide
  // et les specs vivent sous leur propre index.html, et les previews de PR
  // vivent dans le scope du SW de prod mais ne doivent pas être masquées
  // par le shell de prod. On laisse le browser gérer.
  if (e.request.mode === 'navigate') {
    if (STANDALONE_DOCS.some((d) => url.pathname.includes(d))) {
      return
    }
    e.respondWith(
      caches.match(BASE + 'index.html').then((cached) => cached || fetch(e.request))
    )
    return
  }

  // Autres GET : cache-first, lazy-cache au passage.
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request).then((res) => {
      if (res.ok && res.type === 'basic') {
        const clone = res.clone()
        caches.open(cacheNameFor(url.pathname)).then((c) => c.put(e.request, clone))
      }
      return res
    }))
  )
})

// Push : rappel quotidien de séance ou recap hebdomadaire du suivi à distance
// (cf. scripts/send-reminders.mjs). Le payload est un JSON {title, body, url,
// tag}. Fallback défensif si le payload manque/est illisible.
self.addEventListener('push', (e) => {
  let data = {}
  try { data = e.data ? e.data.json() : {} } catch { data = {} }
  const title = data.title || 'Tablito'
  const body = data.body || "C'est l'heure de ta séance Tablito ! 🎯"
  const url = data.url || BASE
  // Un tag par type : au sein d'un type, une notif non lue est remplacée plutôt
  // qu'empilée — mais un recap ne doit pas effacer un rappel de séance, ni
  // l'inverse (ils ne s'adressent même pas à la même personne).
  const tag = data.tag || 'daily-reminder'
  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: BASE + 'icons/icon-192.png',
      badge: BASE + 'icons/icon-192.png',
      tag,
      data: { url },
    })
  )
})

// Clic sur la notif : focus une fenêtre de l'app déjà ouverte, sinon en ouvre une.
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const target = (e.notification.data && e.notification.data.url) || BASE
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if (!('focus' in c)) continue
        // Une app déjà ouverte reprend là où elle en était : sans navigation, le
        // fragment de la notification serait ignoré et le parent retomberait sur
        // l'écran précédent au lieu du recap. On ne navigue QUE dans ce cas — le
        // rappel quotidien pointe sur la racine, et rediriger un enfant en pleine
        // séance lui ferait perdre sa séance.
        const needsNavigate = 'navigate' in c && target !== BASE && c.url !== target
        if (!needsNavigate) return c.focus()
        // navigate() REJETTE sur un client non contrôlé par ce SW — et matchAll
        // ci-dessus inclut volontairement les non contrôlés. Sans ce catch, le
        // rejet remonte au waitUntil et le clic ne fait plus rien du tout.
        return c
          .navigate(target)
          .then((n) => (n || c).focus())
          .catch(() => c.focus())
      }
      if (self.clients.openWindow) return self.clients.openWindow(target)
    })
  )
})
