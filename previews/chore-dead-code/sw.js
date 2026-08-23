// Service Worker minimal.
//
// Stratégie :
//  - install : precache du shell (HTML, JS, CSS, vendor, icônes — pas
//    les médias lourds qui sont chargés à la demande), puis skipWaiting()
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

const CACHE = 'tablito-' + "20260823165319"
const BASE = "/previews/chore-dead-code/"
const ASSETS = [
  "/previews/chore-dead-code/CNAME",
  "/previews/chore-dead-code/favicon.svg",
  "/previews/chore-dead-code/fonts/fonts.css",
  "/previews/chore-dead-code/fonts/fraunces-italic-eQ7ZXk8g.woff2",
  "/previews/chore-dead-code/fonts/fraunces-normal-TeP2Xz5c.woff2",
  "/previews/chore-dead-code/fonts/jetbrains-mono-normal-k6OThhvA.woff2",
  "/previews/chore-dead-code/fonts/nunito-normal-aBTMnFcQ.woff2",
  "/previews/chore-dead-code/icons/apple-touch-icon.png",
  "/previews/chore-dead-code/icons/icon-192.png",
  "/previews/chore-dead-code/icons/icon-512.png",
  "/previews/chore-dead-code/icons/icon.svg",
  "/previews/chore-dead-code/index.html",
  "/previews/chore-dead-code/manifest.en.webmanifest",
  "/previews/chore-dead-code/manifest.webmanifest",
  "/previews/chore-dead-code/specs/index.html",
  "/previews/chore-dead-code/src/App.js",
  "/previews/chore-dead-code/src/components/BackChevron.js",
  "/previews/chore-dead-code/src/components/Badge.js",
  "/previews/chore-dead-code/src/components/BadgeDetailModal.js",
  "/previews/chore-dead-code/src/components/ConjFeedbackOverlay.js",
  "/previews/chore-dead-code/src/components/ConjForm.js",
  "/previews/chore-dead-code/src/components/ConjMysteryImage.js",
  "/previews/chore-dead-code/src/components/ConjProgressGrid.js",
  "/previews/chore-dead-code/src/components/ConjVoiceInput.js",
  "/previews/chore-dead-code/src/components/DivisionMysteryImage.js",
  "/previews/chore-dead-code/src/components/DivisionProgressGrid.js",
  "/previews/chore-dead-code/src/components/DivisionStrategyHint.js",
  "/previews/chore-dead-code/src/components/DotGrid.js",
  "/previews/chore-dead-code/src/components/ErrorBoundary.js",
  "/previews/chore-dead-code/src/components/EvolutionChart.js",
  "/previews/chore-dead-code/src/components/Feather.js",
  "/previews/chore-dead-code/src/components/FeedbackModal.js",
  "/previews/chore-dead-code/src/components/FeedbackOverlay.js",
  "/previews/chore-dead-code/src/components/FeedbackStar.js",
  "/previews/chore-dead-code/src/components/FlameIcon.js",
  "/previews/chore-dead-code/src/components/LanguageToggle.js",
  "/previews/chore-dead-code/src/components/LeitnerGrid.js",
  "/previews/chore-dead-code/src/components/LetterKeyboard.js",
  "/previews/chore-dead-code/src/components/Mascot.js",
  "/previews/chore-dead-code/src/components/Modal.js",
  "/previews/chore-dead-code/src/components/MysteryGrid.js",
  "/previews/chore-dead-code/src/components/MysteryImage.js",
  "/previews/chore-dead-code/src/components/NotificationSettings.js",
  "/previews/chore-dead-code/src/components/NumPad.js",
  "/previews/chore-dead-code/src/components/ParentGate.js",
  "/previews/chore-dead-code/src/components/ParentStats.js",
  "/previews/chore-dead-code/src/components/ProgressGrid.js",
  "/previews/chore-dead-code/src/components/PushToggle.js",
  "/previews/chore-dead-code/src/components/QrCanvas.js",
  "/previews/chore-dead-code/src/components/RemainderMysteryImage.js",
  "/previews/chore-dead-code/src/components/RemainderProgressGrid.js",
  "/previews/chore-dead-code/src/components/RemainderStrategyHint.js",
  "/previews/chore-dead-code/src/components/StrategyHint.js",
  "/previews/chore-dead-code/src/components/StrategyHintShell.js",
  "/previews/chore-dead-code/src/components/StreakDetailModal.js",
  "/previews/chore-dead-code/src/components/VoiceInput.js",
  "/previews/chore-dead-code/src/components/WeeklyRecapSettings.js",
  "/previews/chore-dead-code/src/components/conjHintLine.js",
  "/previews/chore-dead-code/src/env.d.js",
  "/previews/chore-dead-code/src/hooks/useConfetti.js",
  "/previews/chore-dead-code/src/hooks/useInputMode.js",
  "/previews/chore-dead-code/src/hooks/useLatestRef.js",
  "/previews/chore-dead-code/src/hooks/usePushPref.js",
  "/previews/chore-dead-code/src/hooks/useQrScan.js",
  "/previews/chore-dead-code/src/hooks/useSound.js",
  "/previews/chore-dead-code/src/hooks/useSpeechRecognition.js",
  "/previews/chore-dead-code/src/hooks/useTTS.js",
  "/previews/chore-dead-code/src/hooks/useWakeLock.js",
  "/previews/chore-dead-code/src/i18n/LangProvider.js",
  "/previews/chore-dead-code/src/i18n/app.js",
  "/previews/chore-dead-code/src/i18n/badges.js",
  "/previews/chore-dead-code/src/i18n/changelog.js",
  "/previews/chore-dead-code/src/i18n/conjugation.js",
  "/previews/chore-dead-code/src/i18n/home.js",
  "/previews/chore-dead-code/src/i18n/lang.js",
  "/previews/chore-dead-code/src/i18n/language.js",
  "/previews/chore-dead-code/src/i18n/onboarding.js",
  "/previews/chore-dead-code/src/i18n/parent.js",
  "/previews/chore-dead-code/src/i18n/privacy.js",
  "/previews/chore-dead-code/src/i18n/progress.js",
  "/previews/chore-dead-code/src/i18n/recap.js",
  "/previews/chore-dead-code/src/i18n/session.js",
  "/previews/chore-dead-code/src/i18n/strategies.js",
  "/previews/chore-dead-code/src/i18n/voice.js",
  "/previews/chore-dead-code/src/lib/audioContext.js",
  "/previews/chore-dead-code/src/lib/badges.js",
  "/previews/chore-dead-code/src/lib/changelog.js",
  "/previews/chore-dead-code/src/lib/codec.js",
  "/previews/chore-dead-code/src/lib/conjugationComposer.js",
  "/previews/chore-dead-code/src/lib/conjugationFacts.js",
  "/previews/chore-dead-code/src/lib/conjugationInterference.js",
  "/previews/chore-dead-code/src/lib/conjugationPlacement.js",
  "/previews/chore-dead-code/src/lib/conjugationStrategies.js",
  "/previews/chore-dead-code/src/lib/dailyComposer.js",
  "/previews/chore-dead-code/src/lib/debugTools.js",
  "/previews/chore-dead-code/src/lib/divisionComposer.js",
  "/previews/chore-dead-code/src/lib/divisionFacts.js",
  "/previews/chore-dead-code/src/lib/divisionStrategies.js",
  "/previews/chore-dead-code/src/lib/facts.js",
  "/previews/chore-dead-code/src/lib/feedback.js",
  "/previews/chore-dead-code/src/lib/hardestFacts.js",
  "/previews/chore-dead-code/src/lib/install.js",
  "/previews/chore-dead-code/src/lib/leitner.js",
  "/previews/chore-dead-code/src/lib/letterNames.js",
  "/previews/chore-dead-code/src/lib/micPreflight.js",
  "/previews/chore-dead-code/src/lib/parseEnglishNumber.js",
  "/previews/chore-dead-code/src/lib/parseFrenchNumber.js",
  "/previews/chore-dead-code/src/lib/parseSpelledLetters.js",
  "/previews/chore-dead-code/src/lib/parseSpokenNumber.js",
  "/previews/chore-dead-code/src/lib/phoneticDict.js",
  "/previews/chore-dead-code/src/lib/placement.js",
  "/previews/chore-dead-code/src/lib/push.js",
  "/previews/chore-dead-code/src/lib/remainderComposer.js",
  "/previews/chore-dead-code/src/lib/remainderFacts.js",
  "/previews/chore-dead-code/src/lib/remainderStrategies.js",
  "/previews/chore-dead-code/src/lib/sessionComposer.js",
  "/previews/chore-dead-code/src/lib/sessionItemView.js",
  "/previews/chore-dead-code/src/lib/similarity.js",
  "/previews/chore-dead-code/src/lib/spokenNumber.js",
  "/previews/chore-dead-code/src/lib/storage.js",
  "/previews/chore-dead-code/src/lib/strategies.js",
  "/previews/chore-dead-code/src/lib/streak.js",
  "/previews/chore-dead-code/src/lib/supabase.js",
  "/previews/chore-dead-code/src/lib/transfer.js",
  "/previews/chore-dead-code/src/lib/utils.js",
  "/previews/chore-dead-code/src/lib/voiceDebug.js",
  "/previews/chore-dead-code/src/lib/watch.js",
  "/previews/chore-dead-code/src/lib/watchStore.js",
  "/previews/chore-dead-code/src/main.js",
  "/previews/chore-dead-code/src/screens/BadgesScreen.js",
  "/previews/chore-dead-code/src/screens/ChangelogScreen.js",
  "/previews/chore-dead-code/src/screens/ConjPlacementScreen.js",
  "/previews/chore-dead-code/src/screens/HomeScreen.js",
  "/previews/chore-dead-code/src/screens/ParentDashboard.js",
  "/previews/chore-dead-code/src/screens/PrivacyScreen.js",
  "/previews/chore-dead-code/src/screens/ProfileSelectScreen.js",
  "/previews/chore-dead-code/src/screens/ProgressScreen.js",
  "/previews/chore-dead-code/src/screens/RecapScreen.js",
  "/previews/chore-dead-code/src/screens/RulesIntroScreen.js",
  "/previews/chore-dead-code/src/screens/RulesScreen.js",
  "/previews/chore-dead-code/src/screens/SessionScreen.js",
  "/previews/chore-dead-code/src/screens/WelcomeScreen.js",
  "/previews/chore-dead-code/src/types.js",
  "/previews/chore-dead-code/styles.css",
  "/previews/chore-dead-code/vendor/lean-qr/index.mjs",
  "/previews/chore-dead-code/vendor/preact/compat-client.mjs",
  "/previews/chore-dead-code/vendor/preact/compat.module.js",
  "/previews/chore-dead-code/vendor/preact/hooks.module.js",
  "/previews/chore-dead-code/vendor/preact/jsx-runtime.module.js",
  "/previews/chore-dead-code/vendor/preact/preact.module.js"
]

// { groupe: [préfixes d'URL] } et { groupe: hash du contenu } — cf. LAZY_GROUPS
// dans scripts/build.mjs, qui est la source unique de la liste.
const LAZY_GROUPS = {"audio":["/previews/chore-dead-code/audio/"],"media":["/previews/chore-dead-code/mystery/","/previews/chore-dead-code/splash/","/previews/chore-dead-code/video/","/previews/chore-dead-code/vendor/qr-scanner/","/previews/chore-dead-code/img/hero-poster"],"phonetic":["/previews/chore-dead-code/phonetic/"]}
const LAZY_VERSIONS = {"audio":"cc876539251c","media":"b0361ec4d40b","phonetic":"fa4ee22f5b55"}

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
function precache() {
  return caches.open(CACHE).then((c) =>
    Promise.allSettled(ASSETS.map((a) => c.add(a)))
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
    if (url.pathname.includes('/guide/') || url.pathname.includes('/specs/') || url.pathname.includes('/previews/')) {
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
