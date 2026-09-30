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

const CACHE = 'tablito-' + "20260930210700"
const BASE = "/previews/claude-specs-alignees/"
const ASSETS = [
  "/previews/claude-specs-alignees/favicon.svg",
  "/previews/claude-specs-alignees/fonts/fonts.css",
  "/previews/claude-specs-alignees/fonts/fraunces-italic-eQ7ZXk8g.woff2",
  "/previews/claude-specs-alignees/fonts/fraunces-normal-TeP2Xz5c.woff2",
  "/previews/claude-specs-alignees/fonts/jetbrains-mono-normal-k6OThhvA.woff2",
  "/previews/claude-specs-alignees/fonts/nunito-normal-aBTMnFcQ.woff2",
  "/previews/claude-specs-alignees/icons/apple-touch-icon.png",
  "/previews/claude-specs-alignees/icons/icon-192.png",
  "/previews/claude-specs-alignees/icons/icon-512.png",
  "/previews/claude-specs-alignees/icons/icon.svg",
  "/previews/claude-specs-alignees/index.html",
  "/previews/claude-specs-alignees/manifest.en.webmanifest",
  "/previews/claude-specs-alignees/manifest.webmanifest",
  "/previews/claude-specs-alignees/pwa-register.js",
  "/previews/claude-specs-alignees/src/App.js",
  "/previews/claude-specs-alignees/src/components/ActivityStrip.js",
  "/previews/claude-specs-alignees/src/components/BackChevron.js",
  "/previews/claude-specs-alignees/src/components/Badge.js",
  "/previews/claude-specs-alignees/src/components/BadgeDetailModal.js",
  "/previews/claude-specs-alignees/src/components/ConjFeedbackOverlay.js",
  "/previews/claude-specs-alignees/src/components/ConjForm.js",
  "/previews/claude-specs-alignees/src/components/ConjMysteryImage.js",
  "/previews/claude-specs-alignees/src/components/ConjProgressGrid.js",
  "/previews/claude-specs-alignees/src/components/ConjVoiceInput.js",
  "/previews/claude-specs-alignees/src/components/DivisionMysteryImage.js",
  "/previews/claude-specs-alignees/src/components/DivisionProgressGrid.js",
  "/previews/claude-specs-alignees/src/components/DivisionStrategyHint.js",
  "/previews/claude-specs-alignees/src/components/DotGrid.js",
  "/previews/claude-specs-alignees/src/components/ErrorBoundary.js",
  "/previews/claude-specs-alignees/src/components/EvolutionChart.js",
  "/previews/claude-specs-alignees/src/components/Feather.js",
  "/previews/claude-specs-alignees/src/components/FeedbackModal.js",
  "/previews/claude-specs-alignees/src/components/FeedbackOverlay.js",
  "/previews/claude-specs-alignees/src/components/FeedbackStar.js",
  "/previews/claude-specs-alignees/src/components/FlameIcon.js",
  "/previews/claude-specs-alignees/src/components/LanguageToggle.js",
  "/previews/claude-specs-alignees/src/components/LeitnerGrid.js",
  "/previews/claude-specs-alignees/src/components/LetterKeyboard.js",
  "/previews/claude-specs-alignees/src/components/Mascot.js",
  "/previews/claude-specs-alignees/src/components/Modal.js",
  "/previews/claude-specs-alignees/src/components/MysteryGrid.js",
  "/previews/claude-specs-alignees/src/components/MysteryImage.js",
  "/previews/claude-specs-alignees/src/components/NumPad.js",
  "/previews/claude-specs-alignees/src/components/ParentBoxChart.js",
  "/previews/claude-specs-alignees/src/components/ParentChildPicker.js",
  "/previews/claude-specs-alignees/src/components/ParentFeedbackButton.js",
  "/previews/claude-specs-alignees/src/components/ParentGate.js",
  "/previews/claude-specs-alignees/src/components/ParentHardFacts.js",
  "/previews/claude-specs-alignees/src/components/ParentHelpPage.js",
  "/previews/claude-specs-alignees/src/components/ParentHomeIdea.js",
  "/previews/claude-specs-alignees/src/components/ParentMastery.js",
  "/previews/claude-specs-alignees/src/components/ParentOverview.js",
  "/previews/claude-specs-alignees/src/components/ParentProfilesPage.js",
  "/previews/claude-specs-alignees/src/components/ParentQrPanel.js",
  "/previews/claude-specs-alignees/src/components/ParentSegmented.js",
  "/previews/claude-specs-alignees/src/components/ParentSettingIcons.js",
  "/previews/claude-specs-alignees/src/components/ParentSettingRow.js",
  "/previews/claude-specs-alignees/src/components/ParentSettingsList.js",
  "/previews/claude-specs-alignees/src/components/ParentSubjectDetail.js",
  "/previews/claude-specs-alignees/src/components/ParentWatchPage.js",
  "/previews/claude-specs-alignees/src/components/ParentWatchPairing.js",
  "/previews/claude-specs-alignees/src/components/ParentWeekCard.js",
  "/previews/claude-specs-alignees/src/components/ProfileAvatar.js",
  "/previews/claude-specs-alignees/src/components/ProgressGrid.js",
  "/previews/claude-specs-alignees/src/components/PushPrefRow.js",
  "/previews/claude-specs-alignees/src/components/QrCanvas.js",
  "/previews/claude-specs-alignees/src/components/RemainderMysteryImage.js",
  "/previews/claude-specs-alignees/src/components/RemainderProgressGrid.js",
  "/previews/claude-specs-alignees/src/components/RemainderStrategyHint.js",
  "/previews/claude-specs-alignees/src/components/StrategyHint.js",
  "/previews/claude-specs-alignees/src/components/StrategyHintShell.js",
  "/previews/claude-specs-alignees/src/components/StreakDetailModal.js",
  "/previews/claude-specs-alignees/src/components/VoiceInput.js",
  "/previews/claude-specs-alignees/src/components/conjHintLine.js",
  "/previews/claude-specs-alignees/src/hooks/useConfetti.js",
  "/previews/claude-specs-alignees/src/hooks/useCopyFeedback.js",
  "/previews/claude-specs-alignees/src/hooks/useInputMode.js",
  "/previews/claude-specs-alignees/src/hooks/useLatestRef.js",
  "/previews/claude-specs-alignees/src/hooks/usePushPref.js",
  "/previews/claude-specs-alignees/src/hooks/useQrScan.js",
  "/previews/claude-specs-alignees/src/hooks/useSound.js",
  "/previews/claude-specs-alignees/src/hooks/useSpeechRecognition.js",
  "/previews/claude-specs-alignees/src/hooks/useTTS.js",
  "/previews/claude-specs-alignees/src/hooks/useWakeLock.js",
  "/previews/claude-specs-alignees/src/i18n/LangProvider.js",
  "/previews/claude-specs-alignees/src/i18n/app.js",
  "/previews/claude-specs-alignees/src/i18n/badges.js",
  "/previews/claude-specs-alignees/src/i18n/changelog.js",
  "/previews/claude-specs-alignees/src/i18n/conjugation.js",
  "/previews/claude-specs-alignees/src/i18n/home.js",
  "/previews/claude-specs-alignees/src/i18n/homeIdea.js",
  "/previews/claude-specs-alignees/src/i18n/lang.js",
  "/previews/claude-specs-alignees/src/i18n/language.js",
  "/previews/claude-specs-alignees/src/i18n/onboarding.js",
  "/previews/claude-specs-alignees/src/i18n/parent.js",
  "/previews/claude-specs-alignees/src/i18n/parentGate.js",
  "/previews/claude-specs-alignees/src/i18n/privacy.js",
  "/previews/claude-specs-alignees/src/i18n/progress.js",
  "/previews/claude-specs-alignees/src/i18n/recap.js",
  "/previews/claude-specs-alignees/src/i18n/session.js",
  "/previews/claude-specs-alignees/src/i18n/strategies.js",
  "/previews/claude-specs-alignees/src/i18n/tense.js",
  "/previews/claude-specs-alignees/src/i18n/voice.js",
  "/previews/claude-specs-alignees/src/i18n/week.js",
  "/previews/claude-specs-alignees/src/lib/activity.js",
  "/previews/claude-specs-alignees/src/lib/audioContext.js",
  "/previews/claude-specs-alignees/src/lib/badges.js",
  "/previews/claude-specs-alignees/src/lib/changelog.js",
  "/previews/claude-specs-alignees/src/lib/codec.js",
  "/previews/claude-specs-alignees/src/lib/conjugationComposer.js",
  "/previews/claude-specs-alignees/src/lib/conjugationFacts.js",
  "/previews/claude-specs-alignees/src/lib/conjugationInterference.js",
  "/previews/claude-specs-alignees/src/lib/conjugationPlacement.js",
  "/previews/claude-specs-alignees/src/lib/conjugationStrategies.js",
  "/previews/claude-specs-alignees/src/lib/dailyComposer.js",
  "/previews/claude-specs-alignees/src/lib/debugTools.js",
  "/previews/claude-specs-alignees/src/lib/divisionComposer.js",
  "/previews/claude-specs-alignees/src/lib/divisionFacts.js",
  "/previews/claude-specs-alignees/src/lib/divisionStrategies.js",
  "/previews/claude-specs-alignees/src/lib/facts.js",
  "/previews/claude-specs-alignees/src/lib/feedback.js",
  "/previews/claude-specs-alignees/src/lib/hardestFacts.js",
  "/previews/claude-specs-alignees/src/lib/homeIdea.js",
  "/previews/claude-specs-alignees/src/lib/install.js",
  "/previews/claude-specs-alignees/src/lib/leitner.js",
  "/previews/claude-specs-alignees/src/lib/letterNames.js",
  "/previews/claude-specs-alignees/src/lib/micPreflight.js",
  "/previews/claude-specs-alignees/src/lib/parseEnglishNumber.js",
  "/previews/claude-specs-alignees/src/lib/parseFrenchNumber.js",
  "/previews/claude-specs-alignees/src/lib/parseSpelledLetters.js",
  "/previews/claude-specs-alignees/src/lib/parseSpokenNumber.js",
  "/previews/claude-specs-alignees/src/lib/phoneticDict.js",
  "/previews/claude-specs-alignees/src/lib/placement.js",
  "/previews/claude-specs-alignees/src/lib/push.js",
  "/previews/claude-specs-alignees/src/lib/questionClock.js",
  "/previews/claude-specs-alignees/src/lib/remainderComposer.js",
  "/previews/claude-specs-alignees/src/lib/remainderFacts.js",
  "/previews/claude-specs-alignees/src/lib/remainderStrategies.js",
  "/previews/claude-specs-alignees/src/lib/sessionComposer.js",
  "/previews/claude-specs-alignees/src/lib/sessionItemView.js",
  "/previews/claude-specs-alignees/src/lib/sessionTiming.js",
  "/previews/claude-specs-alignees/src/lib/similarity.js",
  "/previews/claude-specs-alignees/src/lib/spokenNumber.js",
  "/previews/claude-specs-alignees/src/lib/storage.js",
  "/previews/claude-specs-alignees/src/lib/strategies.js",
  "/previews/claude-specs-alignees/src/lib/streak.js",
  "/previews/claude-specs-alignees/src/lib/supabase.js",
  "/previews/claude-specs-alignees/src/lib/transfer.js",
  "/previews/claude-specs-alignees/src/lib/utils.js",
  "/previews/claude-specs-alignees/src/lib/version.js",
  "/previews/claude-specs-alignees/src/lib/voiceDebug.js",
  "/previews/claude-specs-alignees/src/lib/watch.js",
  "/previews/claude-specs-alignees/src/lib/watchStore.js",
  "/previews/claude-specs-alignees/src/lib/weekSummary.js",
  "/previews/claude-specs-alignees/src/main.js",
  "/previews/claude-specs-alignees/src/screens/BadgesScreen.js",
  "/previews/claude-specs-alignees/src/screens/ChangelogScreen.js",
  "/previews/claude-specs-alignees/src/screens/ConjPlacementScreen.js",
  "/previews/claude-specs-alignees/src/screens/HomeScreen.js",
  "/previews/claude-specs-alignees/src/screens/ParentDashboard.js",
  "/previews/claude-specs-alignees/src/screens/PrivacyScreen.js",
  "/previews/claude-specs-alignees/src/screens/ProfileSelectScreen.js",
  "/previews/claude-specs-alignees/src/screens/ProgressScreen.js",
  "/previews/claude-specs-alignees/src/screens/RecapScreen.js",
  "/previews/claude-specs-alignees/src/screens/RulesIntroScreen.js",
  "/previews/claude-specs-alignees/src/screens/RulesScreen.js",
  "/previews/claude-specs-alignees/src/screens/SessionScreen.js",
  "/previews/claude-specs-alignees/src/screens/WelcomeScreen.js",
  "/previews/claude-specs-alignees/src/types.js",
  "/previews/claude-specs-alignees/styles.css",
  "/previews/claude-specs-alignees/vendor/preact/compat-client.mjs",
  "/previews/claude-specs-alignees/vendor/preact/compat.module.js",
  "/previews/claude-specs-alignees/vendor/preact/hooks.module.js",
  "/previews/claude-specs-alignees/vendor/preact/jsx-runtime.module.js",
  "/previews/claude-specs-alignees/vendor/preact/preact.module.js"
]

// { groupe: [préfixes d'URL] } et { groupe: hash du contenu } — cf. LAZY_GROUPS
// dans scripts/build.mjs, qui est la source unique de la liste.
const LAZY_GROUPS = {"audio":["/previews/claude-specs-alignees/audio/"],"media":["/previews/claude-specs-alignees/mystery/"],"splash":["/previews/claude-specs-alignees/splash/"],"landing":["/previews/claude-specs-alignees/video/","/previews/claude-specs-alignees/img/hero-poster"],"qrscan":["/previews/claude-specs-alignees/vendor/qr-scanner/"],"phonetic":["/previews/claude-specs-alignees/phonetic/"],"qrgen":["/previews/claude-specs-alignees/vendor/lean-qr/"]}
const LAZY_VERSIONS = {"audio":"9722d24e1026","media":"451f226cdafa","splash":"7cd2da5fda63","landing":"4ddccaf41ca2","qrscan":"1ddb9a3148cc","phonetic":"fa4ee22f5b55","qrgen":"6c1f3275c362"}

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
