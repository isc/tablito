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

const VERSION = "20261021211823"
const CACHE = 'tablito-' + VERSION
const BASE = "/previews/claude-irr-voice-verify/"
const ASSETS = [
  "/previews/claude-irr-voice-verify/favicon.svg",
  "/previews/claude-irr-voice-verify/fonts/fonts.css",
  "/previews/claude-irr-voice-verify/fonts/fraunces-italic-eQ7ZXk8g.woff2",
  "/previews/claude-irr-voice-verify/fonts/fraunces-normal-TeP2Xz5c.woff2",
  "/previews/claude-irr-voice-verify/fonts/jetbrains-mono-normal-k6OThhvA.woff2",
  "/previews/claude-irr-voice-verify/fonts/nunito-normal-aBTMnFcQ.woff2",
  "/previews/claude-irr-voice-verify/icons/apple-touch-icon.png",
  "/previews/claude-irr-voice-verify/icons/icon-192.png",
  "/previews/claude-irr-voice-verify/icons/icon-512.png",
  "/previews/claude-irr-voice-verify/icons/icon.svg",
  "/previews/claude-irr-voice-verify/index.html",
  "/previews/claude-irr-voice-verify/manifest.en.webmanifest",
  "/previews/claude-irr-voice-verify/manifest.webmanifest",
  "/previews/claude-irr-voice-verify/pwa-register.js",
  "/previews/claude-irr-voice-verify/src/App.js",
  "/previews/claude-irr-voice-verify/src/components/ActivityStrip.js",
  "/previews/claude-irr-voice-verify/src/components/BackChevron.js",
  "/previews/claude-irr-voice-verify/src/components/Badge.js",
  "/previews/claude-irr-voice-verify/src/components/BadgeDetailModal.js",
  "/previews/claude-irr-voice-verify/src/components/ConjFeedbackOverlay.js",
  "/previews/claude-irr-voice-verify/src/components/ConjForm.js",
  "/previews/claude-irr-voice-verify/src/components/ConjMysteryImage.js",
  "/previews/claude-irr-voice-verify/src/components/ConjProgressGrid.js",
  "/previews/claude-irr-voice-verify/src/components/ConjQuestionPrompt.js",
  "/previews/claude-irr-voice-verify/src/components/ConjRuleListenButton.js",
  "/previews/claude-irr-voice-verify/src/components/ConjRuleVisual.js",
  "/previews/claude-irr-voice-verify/src/components/ConjVoiceInput.js",
  "/previews/claude-irr-voice-verify/src/components/DivisionMysteryImage.js",
  "/previews/claude-irr-voice-verify/src/components/DivisionProgressGrid.js",
  "/previews/claude-irr-voice-verify/src/components/DivisionStrategyHint.js",
  "/previews/claude-irr-voice-verify/src/components/DotGrid.js",
  "/previews/claude-irr-voice-verify/src/components/ErrorBoundary.js",
  "/previews/claude-irr-voice-verify/src/components/EvolutionChart.js",
  "/previews/claude-irr-voice-verify/src/components/Feather.js",
  "/previews/claude-irr-voice-verify/src/components/FeedbackModal.js",
  "/previews/claude-irr-voice-verify/src/components/FeedbackOverlay.js",
  "/previews/claude-irr-voice-verify/src/components/FeedbackStar.js",
  "/previews/claude-irr-voice-verify/src/components/FlameIcon.js",
  "/previews/claude-irr-voice-verify/src/components/IrrAnswerInput.js",
  "/previews/claude-irr-voice-verify/src/components/IrrClassVerbs.js",
  "/previews/claude-irr-voice-verify/src/components/IrrFeedbackOverlay.js",
  "/previews/claude-irr-voice-verify/src/components/IrrForms.js",
  "/previews/claude-irr-voice-verify/src/components/IrrIntro.js",
  "/previews/claude-irr-voice-verify/src/components/IrrMysteryImage.js",
  "/previews/claude-irr-voice-verify/src/components/IrrProgressGrid.js",
  "/previews/claude-irr-voice-verify/src/components/IrrVoiceInput.js",
  "/previews/claude-irr-voice-verify/src/components/LanguageToggle.js",
  "/previews/claude-irr-voice-verify/src/components/LeitnerGrid.js",
  "/previews/claude-irr-voice-verify/src/components/LetterKeyboard.js",
  "/previews/claude-irr-voice-verify/src/components/ListenButton.js",
  "/previews/claude-irr-voice-verify/src/components/Mascot.js",
  "/previews/claude-irr-voice-verify/src/components/Modal.js",
  "/previews/claude-irr-voice-verify/src/components/MysteryGrid.js",
  "/previews/claude-irr-voice-verify/src/components/MysteryImage.js",
  "/previews/claude-irr-voice-verify/src/components/NumPad.js",
  "/previews/claude-irr-voice-verify/src/components/ParentBoxChart.js",
  "/previews/claude-irr-voice-verify/src/components/ParentChildPicker.js",
  "/previews/claude-irr-voice-verify/src/components/ParentFeedbackButton.js",
  "/previews/claude-irr-voice-verify/src/components/ParentGate.js",
  "/previews/claude-irr-voice-verify/src/components/ParentHardFacts.js",
  "/previews/claude-irr-voice-verify/src/components/ParentHelpPage.js",
  "/previews/claude-irr-voice-verify/src/components/ParentHomeIdea.js",
  "/previews/claude-irr-voice-verify/src/components/ParentMastery.js",
  "/previews/claude-irr-voice-verify/src/components/ParentOverview.js",
  "/previews/claude-irr-voice-verify/src/components/ParentProfilesPage.js",
  "/previews/claude-irr-voice-verify/src/components/ParentQrPanel.js",
  "/previews/claude-irr-voice-verify/src/components/ParentSegmented.js",
  "/previews/claude-irr-voice-verify/src/components/ParentSettingIcons.js",
  "/previews/claude-irr-voice-verify/src/components/ParentSettingRow.js",
  "/previews/claude-irr-voice-verify/src/components/ParentSettingsList.js",
  "/previews/claude-irr-voice-verify/src/components/ParentSubjectDetail.js",
  "/previews/claude-irr-voice-verify/src/components/ParentWatchPage.js",
  "/previews/claude-irr-voice-verify/src/components/ParentWatchPairing.js",
  "/previews/claude-irr-voice-verify/src/components/ParentWeekCard.js",
  "/previews/claude-irr-voice-verify/src/components/ProfileAvatar.js",
  "/previews/claude-irr-voice-verify/src/components/ProgressGrid.js",
  "/previews/claude-irr-voice-verify/src/components/PushPrefRow.js",
  "/previews/claude-irr-voice-verify/src/components/QrCanvas.js",
  "/previews/claude-irr-voice-verify/src/components/RemainderMysteryImage.js",
  "/previews/claude-irr-voice-verify/src/components/RemainderProgressGrid.js",
  "/previews/claude-irr-voice-verify/src/components/RemainderStrategyHint.js",
  "/previews/claude-irr-voice-verify/src/components/StrategyHint.js",
  "/previews/claude-irr-voice-verify/src/components/StrategyHintShell.js",
  "/previews/claude-irr-voice-verify/src/components/StreakDetailModal.js",
  "/previews/claude-irr-voice-verify/src/components/VoiceInput.js",
  "/previews/claude-irr-voice-verify/src/components/conjHintLine.js",
  "/previews/claude-irr-voice-verify/src/hooks/useConfetti.js",
  "/previews/claude-irr-voice-verify/src/hooks/useCopyFeedback.js",
  "/previews/claude-irr-voice-verify/src/hooks/useInputMode.js",
  "/previews/claude-irr-voice-verify/src/hooks/useLatestRef.js",
  "/previews/claude-irr-voice-verify/src/hooks/usePushPref.js",
  "/previews/claude-irr-voice-verify/src/hooks/useQrScan.js",
  "/previews/claude-irr-voice-verify/src/hooks/useSound.js",
  "/previews/claude-irr-voice-verify/src/hooks/useSpeechRecognition.js",
  "/previews/claude-irr-voice-verify/src/hooks/useTTS.js",
  "/previews/claude-irr-voice-verify/src/hooks/useWakeLock.js",
  "/previews/claude-irr-voice-verify/src/i18n/LangProvider.js",
  "/previews/claude-irr-voice-verify/src/i18n/app.js",
  "/previews/claude-irr-voice-verify/src/i18n/badges.js",
  "/previews/claude-irr-voice-verify/src/i18n/changelog.js",
  "/previews/claude-irr-voice-verify/src/i18n/conjugation.js",
  "/previews/claude-irr-voice-verify/src/i18n/home.js",
  "/previews/claude-irr-voice-verify/src/i18n/homeIdea.js",
  "/previews/claude-irr-voice-verify/src/i18n/irregular.js",
  "/previews/claude-irr-voice-verify/src/i18n/lang.js",
  "/previews/claude-irr-voice-verify/src/i18n/language.js",
  "/previews/claude-irr-voice-verify/src/i18n/onboarding.js",
  "/previews/claude-irr-voice-verify/src/i18n/parent.js",
  "/previews/claude-irr-voice-verify/src/i18n/parentGate.js",
  "/previews/claude-irr-voice-verify/src/i18n/privacy.js",
  "/previews/claude-irr-voice-verify/src/i18n/progress.js",
  "/previews/claude-irr-voice-verify/src/i18n/recap.js",
  "/previews/claude-irr-voice-verify/src/i18n/session.js",
  "/previews/claude-irr-voice-verify/src/i18n/strategies.js",
  "/previews/claude-irr-voice-verify/src/i18n/tense.js",
  "/previews/claude-irr-voice-verify/src/i18n/voice.js",
  "/previews/claude-irr-voice-verify/src/i18n/week.js",
  "/previews/claude-irr-voice-verify/src/lib/activity.js",
  "/previews/claude-irr-voice-verify/src/lib/audioContext.js",
  "/previews/claude-irr-voice-verify/src/lib/badges.js",
  "/previews/claude-irr-voice-verify/src/lib/changelog.js",
  "/previews/claude-irr-voice-verify/src/lib/codec.js",
  "/previews/claude-irr-voice-verify/src/lib/conjugationComposer.js",
  "/previews/claude-irr-voice-verify/src/lib/conjugationFacts.js",
  "/previews/claude-irr-voice-verify/src/lib/conjugationInterference.js",
  "/previews/claude-irr-voice-verify/src/lib/conjugationPlacement.js",
  "/previews/claude-irr-voice-verify/src/lib/conjugationRules.js",
  "/previews/claude-irr-voice-verify/src/lib/conjugationStrategies.js",
  "/previews/claude-irr-voice-verify/src/lib/dailyComposer.js",
  "/previews/claude-irr-voice-verify/src/lib/debugTools.js",
  "/previews/claude-irr-voice-verify/src/lib/divisionComposer.js",
  "/previews/claude-irr-voice-verify/src/lib/divisionFacts.js",
  "/previews/claude-irr-voice-verify/src/lib/divisionStrategies.js",
  "/previews/claude-irr-voice-verify/src/lib/facts.js",
  "/previews/claude-irr-voice-verify/src/lib/feedback.js",
  "/previews/claude-irr-voice-verify/src/lib/hardestFacts.js",
  "/previews/claude-irr-voice-verify/src/lib/homeIdea.js",
  "/previews/claude-irr-voice-verify/src/lib/install.js",
  "/previews/claude-irr-voice-verify/src/lib/irregularComposer.js",
  "/previews/claude-irr-voice-verify/src/lib/irregularPlacement.js",
  "/previews/claude-irr-voice-verify/src/lib/irregularVerbs.js",
  "/previews/claude-irr-voice-verify/src/lib/leitner.js",
  "/previews/claude-irr-voice-verify/src/lib/letterNames.js",
  "/previews/claude-irr-voice-verify/src/lib/micPreflight.js",
  "/previews/claude-irr-voice-verify/src/lib/parseEnglishNumber.js",
  "/previews/claude-irr-voice-verify/src/lib/parseFrenchNumber.js",
  "/previews/claude-irr-voice-verify/src/lib/parseSpelledLetters.js",
  "/previews/claude-irr-voice-verify/src/lib/parseSpokenIrregular.js",
  "/previews/claude-irr-voice-verify/src/lib/parseSpokenNumber.js",
  "/previews/claude-irr-voice-verify/src/lib/parseSpokenRemainder.js",
  "/previews/claude-irr-voice-verify/src/lib/phoneticDict.js",
  "/previews/claude-irr-voice-verify/src/lib/placement.js",
  "/previews/claude-irr-voice-verify/src/lib/push.js",
  "/previews/claude-irr-voice-verify/src/lib/questionClock.js",
  "/previews/claude-irr-voice-verify/src/lib/remainderComposer.js",
  "/previews/claude-irr-voice-verify/src/lib/remainderFacts.js",
  "/previews/claude-irr-voice-verify/src/lib/remainderStrategies.js",
  "/previews/claude-irr-voice-verify/src/lib/sessionComposer.js",
  "/previews/claude-irr-voice-verify/src/lib/sessionItemView.js",
  "/previews/claude-irr-voice-verify/src/lib/sessionTiming.js",
  "/previews/claude-irr-voice-verify/src/lib/similarity.js",
  "/previews/claude-irr-voice-verify/src/lib/spokenNumber.js",
  "/previews/claude-irr-voice-verify/src/lib/storage.js",
  "/previews/claude-irr-voice-verify/src/lib/strategies.js",
  "/previews/claude-irr-voice-verify/src/lib/streak.js",
  "/previews/claude-irr-voice-verify/src/lib/supabase.js",
  "/previews/claude-irr-voice-verify/src/lib/transfer.js",
  "/previews/claude-irr-voice-verify/src/lib/utils.js",
  "/previews/claude-irr-voice-verify/src/lib/version.js",
  "/previews/claude-irr-voice-verify/src/lib/voiceDebug.js",
  "/previews/claude-irr-voice-verify/src/lib/watch.js",
  "/previews/claude-irr-voice-verify/src/lib/watchStore.js",
  "/previews/claude-irr-voice-verify/src/lib/weekSummary.js",
  "/previews/claude-irr-voice-verify/src/main.js",
  "/previews/claude-irr-voice-verify/src/screens/BadgesScreen.js",
  "/previews/claude-irr-voice-verify/src/screens/ChangelogScreen.js",
  "/previews/claude-irr-voice-verify/src/screens/ConjPlacementScreen.js",
  "/previews/claude-irr-voice-verify/src/screens/HomeScreen.js",
  "/previews/claude-irr-voice-verify/src/screens/IrrPlacementScreen.js",
  "/previews/claude-irr-voice-verify/src/screens/ParentDashboard.js",
  "/previews/claude-irr-voice-verify/src/screens/PrivacyScreen.js",
  "/previews/claude-irr-voice-verify/src/screens/ProfileSelectScreen.js",
  "/previews/claude-irr-voice-verify/src/screens/ProgressScreen.js",
  "/previews/claude-irr-voice-verify/src/screens/RecapScreen.js",
  "/previews/claude-irr-voice-verify/src/screens/RulesIntroScreen.js",
  "/previews/claude-irr-voice-verify/src/screens/RulesScreen.js",
  "/previews/claude-irr-voice-verify/src/screens/SessionScreen.js",
  "/previews/claude-irr-voice-verify/src/screens/WelcomeScreen.js",
  "/previews/claude-irr-voice-verify/src/types.js",
  "/previews/claude-irr-voice-verify/styles.css",
  "/previews/claude-irr-voice-verify/vendor/preact/compat-client.mjs",
  "/previews/claude-irr-voice-verify/vendor/preact/compat.module.js",
  "/previews/claude-irr-voice-verify/vendor/preact/hooks.module.js",
  "/previews/claude-irr-voice-verify/vendor/preact/jsx-runtime.module.js",
  "/previews/claude-irr-voice-verify/vendor/preact/preact.module.js"
]

// { groupe: [préfixes d'URL] } et { groupe: hash du contenu } — cf. LAZY_GROUPS
// dans scripts/build.mjs, qui est la source unique de la liste.
const LAZY_GROUPS = {"audio":["/previews/claude-irr-voice-verify/audio/"],"media":["/previews/claude-irr-voice-verify/mystery/"],"splash":["/previews/claude-irr-voice-verify/splash/"],"landing":["/previews/claude-irr-voice-verify/video/","/previews/claude-irr-voice-verify/img/hero-poster"],"qrscan":["/previews/claude-irr-voice-verify/vendor/qr-scanner/"],"phonetic":["/previews/claude-irr-voice-verify/phonetic/"],"qrgen":["/previews/claude-irr-voice-verify/vendor/lean-qr/"]}
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
