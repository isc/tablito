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

const VERSION = "20261003061217"
const CACHE = 'tablito-' + VERSION
const BASE = "/previews/ccr-6fa4eac8-62v6kd/"
const ASSETS = [
  "/previews/ccr-6fa4eac8-62v6kd/favicon.svg",
  "/previews/ccr-6fa4eac8-62v6kd/fonts/fonts.css",
  "/previews/ccr-6fa4eac8-62v6kd/fonts/fraunces-italic-eQ7ZXk8g.woff2",
  "/previews/ccr-6fa4eac8-62v6kd/fonts/fraunces-normal-TeP2Xz5c.woff2",
  "/previews/ccr-6fa4eac8-62v6kd/fonts/jetbrains-mono-normal-k6OThhvA.woff2",
  "/previews/ccr-6fa4eac8-62v6kd/fonts/nunito-normal-aBTMnFcQ.woff2",
  "/previews/ccr-6fa4eac8-62v6kd/icons/apple-touch-icon.png",
  "/previews/ccr-6fa4eac8-62v6kd/icons/icon-192.png",
  "/previews/ccr-6fa4eac8-62v6kd/icons/icon-512.png",
  "/previews/ccr-6fa4eac8-62v6kd/icons/icon.svg",
  "/previews/ccr-6fa4eac8-62v6kd/index.html",
  "/previews/ccr-6fa4eac8-62v6kd/manifest.en.webmanifest",
  "/previews/ccr-6fa4eac8-62v6kd/manifest.webmanifest",
  "/previews/ccr-6fa4eac8-62v6kd/pwa-register.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/App.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/ActivityStrip.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/BackChevron.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/Badge.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/BadgeDetailModal.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/ConjFeedbackOverlay.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/ConjForm.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/ConjMysteryImage.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/ConjProgressGrid.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/ConjVoiceInput.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/DivisionMysteryImage.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/DivisionProgressGrid.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/DivisionStrategyHint.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/DotGrid.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/ErrorBoundary.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/EvolutionChart.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/Feather.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/FeedbackModal.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/FeedbackOverlay.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/FeedbackStar.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/FlameIcon.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/LanguageToggle.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/LeitnerGrid.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/LetterKeyboard.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/Mascot.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/Modal.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/MysteryGrid.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/MysteryImage.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/NumPad.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/ParentBoxChart.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/ParentChildPicker.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/ParentFeedbackButton.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/ParentGate.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/ParentHardFacts.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/ParentHelpPage.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/ParentHomeIdea.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/ParentMastery.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/ParentOverview.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/ParentProfilesPage.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/ParentQrPanel.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/ParentSegmented.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/ParentSettingIcons.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/ParentSettingRow.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/ParentSettingsList.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/ParentSubjectDetail.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/ParentWatchPage.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/ParentWatchPairing.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/ParentWeekCard.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/ProfileAvatar.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/ProgressGrid.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/PushPrefRow.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/QrCanvas.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/RemainderMysteryImage.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/RemainderProgressGrid.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/RemainderStrategyHint.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/StrategyHint.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/StrategyHintShell.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/StreakDetailModal.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/VoiceInput.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/components/conjHintLine.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/hooks/useConfetti.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/hooks/useCopyFeedback.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/hooks/useInputMode.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/hooks/useLatestRef.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/hooks/usePushPref.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/hooks/useQrScan.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/hooks/useSound.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/hooks/useSpeechRecognition.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/hooks/useTTS.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/hooks/useWakeLock.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/i18n/LangProvider.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/i18n/app.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/i18n/badges.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/i18n/changelog.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/i18n/conjugation.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/i18n/home.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/i18n/homeIdea.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/i18n/lang.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/i18n/language.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/i18n/onboarding.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/i18n/parent.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/i18n/parentGate.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/i18n/privacy.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/i18n/progress.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/i18n/recap.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/i18n/session.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/i18n/strategies.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/i18n/tense.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/i18n/voice.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/i18n/week.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/activity.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/audioContext.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/badges.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/changelog.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/codec.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/conjugationComposer.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/conjugationFacts.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/conjugationInterference.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/conjugationPlacement.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/conjugationStrategies.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/dailyComposer.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/debugTools.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/divisionComposer.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/divisionFacts.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/divisionStrategies.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/facts.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/feedback.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/hardestFacts.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/homeIdea.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/install.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/leitner.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/letterNames.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/micPreflight.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/parseEnglishNumber.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/parseFrenchNumber.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/parseSpelledLetters.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/parseSpokenNumber.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/parseSpokenRemainder.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/phoneticDict.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/placement.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/push.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/questionClock.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/remainderComposer.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/remainderFacts.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/remainderStrategies.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/sessionComposer.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/sessionItemView.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/sessionTiming.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/similarity.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/spokenNumber.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/storage.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/strategies.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/streak.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/supabase.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/transfer.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/utils.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/version.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/voiceDebug.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/watch.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/watchStore.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/lib/weekSummary.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/main.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/screens/BadgesScreen.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/screens/ChangelogScreen.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/screens/ConjPlacementScreen.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/screens/HomeScreen.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/screens/ParentDashboard.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/screens/PrivacyScreen.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/screens/ProfileSelectScreen.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/screens/ProgressScreen.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/screens/RecapScreen.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/screens/RulesIntroScreen.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/screens/RulesScreen.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/screens/SessionScreen.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/screens/WelcomeScreen.js",
  "/previews/ccr-6fa4eac8-62v6kd/src/types.js",
  "/previews/ccr-6fa4eac8-62v6kd/styles.css",
  "/previews/ccr-6fa4eac8-62v6kd/vendor/preact/compat-client.mjs",
  "/previews/ccr-6fa4eac8-62v6kd/vendor/preact/compat.module.js",
  "/previews/ccr-6fa4eac8-62v6kd/vendor/preact/hooks.module.js",
  "/previews/ccr-6fa4eac8-62v6kd/vendor/preact/jsx-runtime.module.js",
  "/previews/ccr-6fa4eac8-62v6kd/vendor/preact/preact.module.js"
]

// { groupe: [préfixes d'URL] } et { groupe: hash du contenu } — cf. LAZY_GROUPS
// dans scripts/build.mjs, qui est la source unique de la liste.
const LAZY_GROUPS = {"audio":["/previews/ccr-6fa4eac8-62v6kd/audio/"],"media":["/previews/ccr-6fa4eac8-62v6kd/mystery/"],"splash":["/previews/ccr-6fa4eac8-62v6kd/splash/"],"landing":["/previews/ccr-6fa4eac8-62v6kd/video/","/previews/ccr-6fa4eac8-62v6kd/img/hero-poster"],"qrscan":["/previews/ccr-6fa4eac8-62v6kd/vendor/qr-scanner/"],"phonetic":["/previews/ccr-6fa4eac8-62v6kd/phonetic/"],"qrgen":["/previews/ccr-6fa4eac8-62v6kd/vendor/lean-qr/"]}
const LAZY_VERSIONS = {"audio":"e6a6dad5117a","media":"451f226cdafa","splash":"7cd2da5fda63","landing":"4ddccaf41ca2","qrscan":"1ddb9a3148cc","phonetic":"fa4ee22f5b55","qrgen":"6c1f3275c362"}

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
