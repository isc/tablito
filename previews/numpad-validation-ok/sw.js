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

const VERSION = "20261028084215"
const CACHE = 'tablito-' + VERSION
const BASE = "/previews/numpad-validation-ok/"
const ASSETS = [
  "/previews/numpad-validation-ok/favicon.svg",
  "/previews/numpad-validation-ok/fonts/fonts.css",
  "/previews/numpad-validation-ok/fonts/fraunces-italic-eQ7ZXk8g.woff2",
  "/previews/numpad-validation-ok/fonts/fraunces-normal-TeP2Xz5c.woff2",
  "/previews/numpad-validation-ok/fonts/jetbrains-mono-normal-k6OThhvA.woff2",
  "/previews/numpad-validation-ok/fonts/nunito-normal-aBTMnFcQ.woff2",
  "/previews/numpad-validation-ok/icons/apple-touch-icon.png",
  "/previews/numpad-validation-ok/icons/icon-192.png",
  "/previews/numpad-validation-ok/icons/icon-512.png",
  "/previews/numpad-validation-ok/icons/icon.svg",
  "/previews/numpad-validation-ok/index.html",
  "/previews/numpad-validation-ok/manifest.en.webmanifest",
  "/previews/numpad-validation-ok/manifest.webmanifest",
  "/previews/numpad-validation-ok/pwa-register.js",
  "/previews/numpad-validation-ok/src/App.js",
  "/previews/numpad-validation-ok/src/components/ActivityStrip.js",
  "/previews/numpad-validation-ok/src/components/BackChevron.js",
  "/previews/numpad-validation-ok/src/components/Badge.js",
  "/previews/numpad-validation-ok/src/components/BadgeDetailModal.js",
  "/previews/numpad-validation-ok/src/components/ConjFeedbackOverlay.js",
  "/previews/numpad-validation-ok/src/components/ConjForm.js",
  "/previews/numpad-validation-ok/src/components/ConjMysteryImage.js",
  "/previews/numpad-validation-ok/src/components/ConjProgressGrid.js",
  "/previews/numpad-validation-ok/src/components/ConjQuestionPrompt.js",
  "/previews/numpad-validation-ok/src/components/ConjRuleListenButton.js",
  "/previews/numpad-validation-ok/src/components/ConjRuleVisual.js",
  "/previews/numpad-validation-ok/src/components/ConjVoiceInput.js",
  "/previews/numpad-validation-ok/src/components/DivisionMysteryImage.js",
  "/previews/numpad-validation-ok/src/components/DivisionProgressGrid.js",
  "/previews/numpad-validation-ok/src/components/DivisionStrategyHint.js",
  "/previews/numpad-validation-ok/src/components/DotGrid.js",
  "/previews/numpad-validation-ok/src/components/ErrorBoundary.js",
  "/previews/numpad-validation-ok/src/components/EvolutionChart.js",
  "/previews/numpad-validation-ok/src/components/Feather.js",
  "/previews/numpad-validation-ok/src/components/FeedbackModal.js",
  "/previews/numpad-validation-ok/src/components/FeedbackOverlay.js",
  "/previews/numpad-validation-ok/src/components/FeedbackStar.js",
  "/previews/numpad-validation-ok/src/components/FlameIcon.js",
  "/previews/numpad-validation-ok/src/components/IrrAnswerInput.js",
  "/previews/numpad-validation-ok/src/components/IrrClassVerbs.js",
  "/previews/numpad-validation-ok/src/components/IrrFeedbackOverlay.js",
  "/previews/numpad-validation-ok/src/components/IrrForms.js",
  "/previews/numpad-validation-ok/src/components/IrrIntro.js",
  "/previews/numpad-validation-ok/src/components/IrrMysteryImage.js",
  "/previews/numpad-validation-ok/src/components/IrrProgressGrid.js",
  "/previews/numpad-validation-ok/src/components/IrrVoiceInput.js",
  "/previews/numpad-validation-ok/src/components/LanguageToggle.js",
  "/previews/numpad-validation-ok/src/components/LeitnerGrid.js",
  "/previews/numpad-validation-ok/src/components/LetterKeyboard.js",
  "/previews/numpad-validation-ok/src/components/ListenButton.js",
  "/previews/numpad-validation-ok/src/components/Mascot.js",
  "/previews/numpad-validation-ok/src/components/Modal.js",
  "/previews/numpad-validation-ok/src/components/MysteryGrid.js",
  "/previews/numpad-validation-ok/src/components/MysteryImage.js",
  "/previews/numpad-validation-ok/src/components/NumPad.js",
  "/previews/numpad-validation-ok/src/components/ParentBoxChart.js",
  "/previews/numpad-validation-ok/src/components/ParentChildPicker.js",
  "/previews/numpad-validation-ok/src/components/ParentFeedbackButton.js",
  "/previews/numpad-validation-ok/src/components/ParentGate.js",
  "/previews/numpad-validation-ok/src/components/ParentHardFacts.js",
  "/previews/numpad-validation-ok/src/components/ParentHelpPage.js",
  "/previews/numpad-validation-ok/src/components/ParentHomeIdea.js",
  "/previews/numpad-validation-ok/src/components/ParentMastery.js",
  "/previews/numpad-validation-ok/src/components/ParentOverview.js",
  "/previews/numpad-validation-ok/src/components/ParentProfilesPage.js",
  "/previews/numpad-validation-ok/src/components/ParentQrPanel.js",
  "/previews/numpad-validation-ok/src/components/ParentSegmented.js",
  "/previews/numpad-validation-ok/src/components/ParentSettingIcons.js",
  "/previews/numpad-validation-ok/src/components/ParentSettingRow.js",
  "/previews/numpad-validation-ok/src/components/ParentSettingsList.js",
  "/previews/numpad-validation-ok/src/components/ParentSubjectDetail.js",
  "/previews/numpad-validation-ok/src/components/ParentWatchPage.js",
  "/previews/numpad-validation-ok/src/components/ParentWatchPairing.js",
  "/previews/numpad-validation-ok/src/components/ParentWeekCard.js",
  "/previews/numpad-validation-ok/src/components/ProfileAvatar.js",
  "/previews/numpad-validation-ok/src/components/ProgressGrid.js",
  "/previews/numpad-validation-ok/src/components/PushPrefRow.js",
  "/previews/numpad-validation-ok/src/components/QrCanvas.js",
  "/previews/numpad-validation-ok/src/components/RemainderMysteryImage.js",
  "/previews/numpad-validation-ok/src/components/RemainderProgressGrid.js",
  "/previews/numpad-validation-ok/src/components/RemainderStrategyHint.js",
  "/previews/numpad-validation-ok/src/components/StrategyHint.js",
  "/previews/numpad-validation-ok/src/components/StrategyHintShell.js",
  "/previews/numpad-validation-ok/src/components/StreakDetailModal.js",
  "/previews/numpad-validation-ok/src/components/VoiceInput.js",
  "/previews/numpad-validation-ok/src/components/conjHintLine.js",
  "/previews/numpad-validation-ok/src/hooks/useBackGesture.js",
  "/previews/numpad-validation-ok/src/hooks/useConfetti.js",
  "/previews/numpad-validation-ok/src/hooks/useCopyFeedback.js",
  "/previews/numpad-validation-ok/src/hooks/useInputMode.js",
  "/previews/numpad-validation-ok/src/hooks/useLatestRef.js",
  "/previews/numpad-validation-ok/src/hooks/usePushPref.js",
  "/previews/numpad-validation-ok/src/hooks/useQrScan.js",
  "/previews/numpad-validation-ok/src/hooks/useSound.js",
  "/previews/numpad-validation-ok/src/hooks/useSpeechRecognition.js",
  "/previews/numpad-validation-ok/src/hooks/useTTS.js",
  "/previews/numpad-validation-ok/src/hooks/useWakeLock.js",
  "/previews/numpad-validation-ok/src/i18n/LangProvider.js",
  "/previews/numpad-validation-ok/src/i18n/app.js",
  "/previews/numpad-validation-ok/src/i18n/badges.js",
  "/previews/numpad-validation-ok/src/i18n/changelog.js",
  "/previews/numpad-validation-ok/src/i18n/conjugation.js",
  "/previews/numpad-validation-ok/src/i18n/home.js",
  "/previews/numpad-validation-ok/src/i18n/homeIdea.js",
  "/previews/numpad-validation-ok/src/i18n/irregular.js",
  "/previews/numpad-validation-ok/src/i18n/lang.js",
  "/previews/numpad-validation-ok/src/i18n/language.js",
  "/previews/numpad-validation-ok/src/i18n/onboarding.js",
  "/previews/numpad-validation-ok/src/i18n/parent.js",
  "/previews/numpad-validation-ok/src/i18n/parentGate.js",
  "/previews/numpad-validation-ok/src/i18n/privacy.js",
  "/previews/numpad-validation-ok/src/i18n/progress.js",
  "/previews/numpad-validation-ok/src/i18n/recap.js",
  "/previews/numpad-validation-ok/src/i18n/session.js",
  "/previews/numpad-validation-ok/src/i18n/strategies.js",
  "/previews/numpad-validation-ok/src/i18n/tense.js",
  "/previews/numpad-validation-ok/src/i18n/voice.js",
  "/previews/numpad-validation-ok/src/i18n/week.js",
  "/previews/numpad-validation-ok/src/lib/activity.js",
  "/previews/numpad-validation-ok/src/lib/audioContext.js",
  "/previews/numpad-validation-ok/src/lib/badges.js",
  "/previews/numpad-validation-ok/src/lib/changelog.js",
  "/previews/numpad-validation-ok/src/lib/codec.js",
  "/previews/numpad-validation-ok/src/lib/conjugationComposer.js",
  "/previews/numpad-validation-ok/src/lib/conjugationFacts.js",
  "/previews/numpad-validation-ok/src/lib/conjugationInterference.js",
  "/previews/numpad-validation-ok/src/lib/conjugationPlacement.js",
  "/previews/numpad-validation-ok/src/lib/conjugationRules.js",
  "/previews/numpad-validation-ok/src/lib/conjugationStrategies.js",
  "/previews/numpad-validation-ok/src/lib/dailyComposer.js",
  "/previews/numpad-validation-ok/src/lib/debugTools.js",
  "/previews/numpad-validation-ok/src/lib/divisionComposer.js",
  "/previews/numpad-validation-ok/src/lib/divisionFacts.js",
  "/previews/numpad-validation-ok/src/lib/divisionStrategies.js",
  "/previews/numpad-validation-ok/src/lib/facts.js",
  "/previews/numpad-validation-ok/src/lib/feedback.js",
  "/previews/numpad-validation-ok/src/lib/hardestFacts.js",
  "/previews/numpad-validation-ok/src/lib/homeIdea.js",
  "/previews/numpad-validation-ok/src/lib/install.js",
  "/previews/numpad-validation-ok/src/lib/irregularComposer.js",
  "/previews/numpad-validation-ok/src/lib/irregularPlacement.js",
  "/previews/numpad-validation-ok/src/lib/irregularVerbs.js",
  "/previews/numpad-validation-ok/src/lib/leitner.js",
  "/previews/numpad-validation-ok/src/lib/letterKeys.js",
  "/previews/numpad-validation-ok/src/lib/letterNames.js",
  "/previews/numpad-validation-ok/src/lib/micPreflight.js",
  "/previews/numpad-validation-ok/src/lib/parseEnglishNumber.js",
  "/previews/numpad-validation-ok/src/lib/parseFrenchNumber.js",
  "/previews/numpad-validation-ok/src/lib/parseSpelledLetters.js",
  "/previews/numpad-validation-ok/src/lib/parseSpokenIrregular.js",
  "/previews/numpad-validation-ok/src/lib/parseSpokenNumber.js",
  "/previews/numpad-validation-ok/src/lib/parseSpokenRemainder.js",
  "/previews/numpad-validation-ok/src/lib/phoneticDict.js",
  "/previews/numpad-validation-ok/src/lib/placement.js",
  "/previews/numpad-validation-ok/src/lib/push.js",
  "/previews/numpad-validation-ok/src/lib/questionClock.js",
  "/previews/numpad-validation-ok/src/lib/remainderComposer.js",
  "/previews/numpad-validation-ok/src/lib/remainderFacts.js",
  "/previews/numpad-validation-ok/src/lib/remainderStrategies.js",
  "/previews/numpad-validation-ok/src/lib/sessionComposer.js",
  "/previews/numpad-validation-ok/src/lib/sessionItemView.js",
  "/previews/numpad-validation-ok/src/lib/sessionTiming.js",
  "/previews/numpad-validation-ok/src/lib/similarity.js",
  "/previews/numpad-validation-ok/src/lib/spokenNumber.js",
  "/previews/numpad-validation-ok/src/lib/storage.js",
  "/previews/numpad-validation-ok/src/lib/strategies.js",
  "/previews/numpad-validation-ok/src/lib/streak.js",
  "/previews/numpad-validation-ok/src/lib/supabase.js",
  "/previews/numpad-validation-ok/src/lib/transfer.js",
  "/previews/numpad-validation-ok/src/lib/utils.js",
  "/previews/numpad-validation-ok/src/lib/version.js",
  "/previews/numpad-validation-ok/src/lib/voiceDebug.js",
  "/previews/numpad-validation-ok/src/lib/watch.js",
  "/previews/numpad-validation-ok/src/lib/watchStore.js",
  "/previews/numpad-validation-ok/src/lib/weekSummary.js",
  "/previews/numpad-validation-ok/src/main.js",
  "/previews/numpad-validation-ok/src/screens/BadgesScreen.js",
  "/previews/numpad-validation-ok/src/screens/ChangelogScreen.js",
  "/previews/numpad-validation-ok/src/screens/ConjPlacementScreen.js",
  "/previews/numpad-validation-ok/src/screens/HomeScreen.js",
  "/previews/numpad-validation-ok/src/screens/IrrPlacementScreen.js",
  "/previews/numpad-validation-ok/src/screens/ParentDashboard.js",
  "/previews/numpad-validation-ok/src/screens/PrivacyScreen.js",
  "/previews/numpad-validation-ok/src/screens/ProfileSelectScreen.js",
  "/previews/numpad-validation-ok/src/screens/ProgressScreen.js",
  "/previews/numpad-validation-ok/src/screens/RecapScreen.js",
  "/previews/numpad-validation-ok/src/screens/RulesIntroScreen.js",
  "/previews/numpad-validation-ok/src/screens/RulesScreen.js",
  "/previews/numpad-validation-ok/src/screens/SessionScreen.js",
  "/previews/numpad-validation-ok/src/screens/WelcomeScreen.js",
  "/previews/numpad-validation-ok/src/types.js",
  "/previews/numpad-validation-ok/styles.css",
  "/previews/numpad-validation-ok/vendor/preact/compat-client.mjs",
  "/previews/numpad-validation-ok/vendor/preact/compat.module.js",
  "/previews/numpad-validation-ok/vendor/preact/hooks.module.js",
  "/previews/numpad-validation-ok/vendor/preact/jsx-runtime.module.js",
  "/previews/numpad-validation-ok/vendor/preact/preact.module.js"
]

// { groupe: [préfixes d'URL] } et { groupe: hash du contenu } — cf. LAZY_GROUPS
// dans scripts/build.mjs, qui est la source unique de la liste.
const LAZY_GROUPS = {"audio":["/previews/numpad-validation-ok/audio/"],"media":["/previews/numpad-validation-ok/mystery/"],"splash":["/previews/numpad-validation-ok/splash/"],"landing":["/previews/numpad-validation-ok/video/","/previews/numpad-validation-ok/img/hero-poster"],"qrscan":["/previews/numpad-validation-ok/vendor/qr-scanner/"],"phonetic":["/previews/numpad-validation-ok/phonetic/"],"qrgen":["/previews/numpad-validation-ok/vendor/lean-qr/"]}
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
