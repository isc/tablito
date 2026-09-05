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

const CACHE = 'tablito-' + "20260905121553"
const BASE = "/previews/align-playwright-chromium/"
const ASSETS = [
  "/previews/align-playwright-chromium/favicon.svg",
  "/previews/align-playwright-chromium/fonts/fonts.css",
  "/previews/align-playwright-chromium/fonts/fraunces-italic-eQ7ZXk8g.woff2",
  "/previews/align-playwright-chromium/fonts/fraunces-normal-TeP2Xz5c.woff2",
  "/previews/align-playwright-chromium/fonts/jetbrains-mono-normal-k6OThhvA.woff2",
  "/previews/align-playwright-chromium/fonts/nunito-normal-aBTMnFcQ.woff2",
  "/previews/align-playwright-chromium/icons/apple-touch-icon.png",
  "/previews/align-playwright-chromium/icons/icon-192.png",
  "/previews/align-playwright-chromium/icons/icon-512.png",
  "/previews/align-playwright-chromium/icons/icon.svg",
  "/previews/align-playwright-chromium/index.html",
  "/previews/align-playwright-chromium/manifest.en.webmanifest",
  "/previews/align-playwright-chromium/manifest.webmanifest",
  "/previews/align-playwright-chromium/src/App.js",
  "/previews/align-playwright-chromium/src/components/BackChevron.js",
  "/previews/align-playwright-chromium/src/components/Badge.js",
  "/previews/align-playwright-chromium/src/components/BadgeDetailModal.js",
  "/previews/align-playwright-chromium/src/components/ConjFeedbackOverlay.js",
  "/previews/align-playwright-chromium/src/components/ConjForm.js",
  "/previews/align-playwright-chromium/src/components/ConjMysteryImage.js",
  "/previews/align-playwright-chromium/src/components/ConjProgressGrid.js",
  "/previews/align-playwright-chromium/src/components/ConjVoiceInput.js",
  "/previews/align-playwright-chromium/src/components/DivisionMysteryImage.js",
  "/previews/align-playwright-chromium/src/components/DivisionProgressGrid.js",
  "/previews/align-playwright-chromium/src/components/DivisionStrategyHint.js",
  "/previews/align-playwright-chromium/src/components/DotGrid.js",
  "/previews/align-playwright-chromium/src/components/ErrorBoundary.js",
  "/previews/align-playwright-chromium/src/components/EvolutionChart.js",
  "/previews/align-playwright-chromium/src/components/Feather.js",
  "/previews/align-playwright-chromium/src/components/FeedbackModal.js",
  "/previews/align-playwright-chromium/src/components/FeedbackOverlay.js",
  "/previews/align-playwright-chromium/src/components/FeedbackStar.js",
  "/previews/align-playwright-chromium/src/components/FlameIcon.js",
  "/previews/align-playwright-chromium/src/components/LanguageToggle.js",
  "/previews/align-playwright-chromium/src/components/LeitnerGrid.js",
  "/previews/align-playwright-chromium/src/components/LetterKeyboard.js",
  "/previews/align-playwright-chromium/src/components/Mascot.js",
  "/previews/align-playwright-chromium/src/components/Modal.js",
  "/previews/align-playwright-chromium/src/components/MysteryGrid.js",
  "/previews/align-playwright-chromium/src/components/MysteryImage.js",
  "/previews/align-playwright-chromium/src/components/NotificationSettings.js",
  "/previews/align-playwright-chromium/src/components/NumPad.js",
  "/previews/align-playwright-chromium/src/components/ParentGate.js",
  "/previews/align-playwright-chromium/src/components/ParentStats.js",
  "/previews/align-playwright-chromium/src/components/ProgressGrid.js",
  "/previews/align-playwright-chromium/src/components/PushToggle.js",
  "/previews/align-playwright-chromium/src/components/QrCanvas.js",
  "/previews/align-playwright-chromium/src/components/RemainderMysteryImage.js",
  "/previews/align-playwright-chromium/src/components/RemainderProgressGrid.js",
  "/previews/align-playwright-chromium/src/components/RemainderStrategyHint.js",
  "/previews/align-playwright-chromium/src/components/StrategyHint.js",
  "/previews/align-playwright-chromium/src/components/StrategyHintShell.js",
  "/previews/align-playwright-chromium/src/components/StreakDetailModal.js",
  "/previews/align-playwright-chromium/src/components/VoiceInput.js",
  "/previews/align-playwright-chromium/src/components/WeeklyRecapSettings.js",
  "/previews/align-playwright-chromium/src/components/conjHintLine.js",
  "/previews/align-playwright-chromium/src/hooks/useConfetti.js",
  "/previews/align-playwright-chromium/src/hooks/useInputMode.js",
  "/previews/align-playwright-chromium/src/hooks/useLatestRef.js",
  "/previews/align-playwright-chromium/src/hooks/usePushPref.js",
  "/previews/align-playwright-chromium/src/hooks/useQrScan.js",
  "/previews/align-playwright-chromium/src/hooks/useSound.js",
  "/previews/align-playwright-chromium/src/hooks/useSpeechRecognition.js",
  "/previews/align-playwright-chromium/src/hooks/useTTS.js",
  "/previews/align-playwright-chromium/src/hooks/useWakeLock.js",
  "/previews/align-playwright-chromium/src/i18n/LangProvider.js",
  "/previews/align-playwright-chromium/src/i18n/app.js",
  "/previews/align-playwright-chromium/src/i18n/badges.js",
  "/previews/align-playwright-chromium/src/i18n/changelog.js",
  "/previews/align-playwright-chromium/src/i18n/conjugation.js",
  "/previews/align-playwright-chromium/src/i18n/home.js",
  "/previews/align-playwright-chromium/src/i18n/lang.js",
  "/previews/align-playwright-chromium/src/i18n/language.js",
  "/previews/align-playwright-chromium/src/i18n/onboarding.js",
  "/previews/align-playwright-chromium/src/i18n/parent.js",
  "/previews/align-playwright-chromium/src/i18n/privacy.js",
  "/previews/align-playwright-chromium/src/i18n/progress.js",
  "/previews/align-playwright-chromium/src/i18n/recap.js",
  "/previews/align-playwright-chromium/src/i18n/session.js",
  "/previews/align-playwright-chromium/src/i18n/strategies.js",
  "/previews/align-playwright-chromium/src/i18n/voice.js",
  "/previews/align-playwright-chromium/src/lib/audioContext.js",
  "/previews/align-playwright-chromium/src/lib/badges.js",
  "/previews/align-playwright-chromium/src/lib/changelog.js",
  "/previews/align-playwright-chromium/src/lib/codec.js",
  "/previews/align-playwright-chromium/src/lib/conjugationComposer.js",
  "/previews/align-playwright-chromium/src/lib/conjugationFacts.js",
  "/previews/align-playwright-chromium/src/lib/conjugationInterference.js",
  "/previews/align-playwright-chromium/src/lib/conjugationPlacement.js",
  "/previews/align-playwright-chromium/src/lib/conjugationStrategies.js",
  "/previews/align-playwright-chromium/src/lib/dailyComposer.js",
  "/previews/align-playwright-chromium/src/lib/debugTools.js",
  "/previews/align-playwright-chromium/src/lib/divisionComposer.js",
  "/previews/align-playwright-chromium/src/lib/divisionFacts.js",
  "/previews/align-playwright-chromium/src/lib/divisionStrategies.js",
  "/previews/align-playwright-chromium/src/lib/facts.js",
  "/previews/align-playwright-chromium/src/lib/feedback.js",
  "/previews/align-playwright-chromium/src/lib/hardestFacts.js",
  "/previews/align-playwright-chromium/src/lib/install.js",
  "/previews/align-playwright-chromium/src/lib/leitner.js",
  "/previews/align-playwright-chromium/src/lib/letterNames.js",
  "/previews/align-playwright-chromium/src/lib/micPreflight.js",
  "/previews/align-playwright-chromium/src/lib/parseEnglishNumber.js",
  "/previews/align-playwright-chromium/src/lib/parseFrenchNumber.js",
  "/previews/align-playwright-chromium/src/lib/parseSpelledLetters.js",
  "/previews/align-playwright-chromium/src/lib/parseSpokenNumber.js",
  "/previews/align-playwright-chromium/src/lib/phoneticDict.js",
  "/previews/align-playwright-chromium/src/lib/placement.js",
  "/previews/align-playwright-chromium/src/lib/push.js",
  "/previews/align-playwright-chromium/src/lib/questionClock.js",
  "/previews/align-playwright-chromium/src/lib/remainderComposer.js",
  "/previews/align-playwright-chromium/src/lib/remainderFacts.js",
  "/previews/align-playwright-chromium/src/lib/remainderStrategies.js",
  "/previews/align-playwright-chromium/src/lib/sessionComposer.js",
  "/previews/align-playwright-chromium/src/lib/sessionItemView.js",
  "/previews/align-playwright-chromium/src/lib/sessionTiming.js",
  "/previews/align-playwright-chromium/src/lib/similarity.js",
  "/previews/align-playwright-chromium/src/lib/spokenNumber.js",
  "/previews/align-playwright-chromium/src/lib/storage.js",
  "/previews/align-playwright-chromium/src/lib/strategies.js",
  "/previews/align-playwright-chromium/src/lib/streak.js",
  "/previews/align-playwright-chromium/src/lib/supabase.js",
  "/previews/align-playwright-chromium/src/lib/transfer.js",
  "/previews/align-playwright-chromium/src/lib/utils.js",
  "/previews/align-playwright-chromium/src/lib/voiceDebug.js",
  "/previews/align-playwright-chromium/src/lib/watch.js",
  "/previews/align-playwright-chromium/src/lib/watchStore.js",
  "/previews/align-playwright-chromium/src/main.js",
  "/previews/align-playwright-chromium/src/screens/BadgesScreen.js",
  "/previews/align-playwright-chromium/src/screens/ChangelogScreen.js",
  "/previews/align-playwright-chromium/src/screens/ConjPlacementScreen.js",
  "/previews/align-playwright-chromium/src/screens/HomeScreen.js",
  "/previews/align-playwright-chromium/src/screens/ParentDashboard.js",
  "/previews/align-playwright-chromium/src/screens/PrivacyScreen.js",
  "/previews/align-playwright-chromium/src/screens/ProfileSelectScreen.js",
  "/previews/align-playwright-chromium/src/screens/ProgressScreen.js",
  "/previews/align-playwright-chromium/src/screens/RecapScreen.js",
  "/previews/align-playwright-chromium/src/screens/RulesIntroScreen.js",
  "/previews/align-playwright-chromium/src/screens/RulesScreen.js",
  "/previews/align-playwright-chromium/src/screens/SessionScreen.js",
  "/previews/align-playwright-chromium/src/screens/WelcomeScreen.js",
  "/previews/align-playwright-chromium/src/types.js",
  "/previews/align-playwright-chromium/styles.css",
  "/previews/align-playwright-chromium/vendor/preact/compat-client.mjs",
  "/previews/align-playwright-chromium/vendor/preact/compat.module.js",
  "/previews/align-playwright-chromium/vendor/preact/hooks.module.js",
  "/previews/align-playwright-chromium/vendor/preact/jsx-runtime.module.js",
  "/previews/align-playwright-chromium/vendor/preact/preact.module.js"
]

// { groupe: [préfixes d'URL] } et { groupe: hash du contenu } — cf. LAZY_GROUPS
// dans scripts/build.mjs, qui est la source unique de la liste.
const LAZY_GROUPS = {"audio":["/previews/align-playwright-chromium/audio/"],"media":["/previews/align-playwright-chromium/mystery/","/previews/align-playwright-chromium/splash/","/previews/align-playwright-chromium/video/","/previews/align-playwright-chromium/vendor/qr-scanner/","/previews/align-playwright-chromium/img/hero-poster"],"phonetic":["/previews/align-playwright-chromium/phonetic/"],"qrgen":["/previews/align-playwright-chromium/vendor/lean-qr/"]}
const LAZY_VERSIONS = {"audio":"cc876539251c","media":"b0361ec4d40b","phonetic":"fa4ee22f5b55","qrgen":"6c1f3275c362"}

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
