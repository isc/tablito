import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import type { UserProfile } from '../types';
import BackChevron from '../components/BackChevron';
import ParentHelpPage from '../components/ParentHelpPage';
import ParentOverview from '../components/ParentOverview';
import ParentProfilesPage from '../components/ParentProfilesPage';
import ParentSettingsList from '../components/ParentSettingsList';
import ParentSubjectDetail from '../components/ParentSubjectDetail';
import ParentWatchPage from '../components/ParentWatchPage';
import { useParentDashboardStrings } from '../i18n/parent';
import type { Subject } from '../lib/hardestFacts';
import { APP_VERSION } from '../lib/version';
import { setPushPref } from '../lib/push';
import { fetchWatched, type WatchFetchResult, type WatchPairing } from '../lib/watch';
import { listWatched, removeWatched, watchConfigured, type WatchedProfile } from '../lib/watchStore';

// Pages d'information d'« Aide et infos », rarement ouvertes : chargées à la
// demande, comme l'espace parent lui-même.
const PrivacyScreen = lazy(() => import('./PrivacyScreen'));
const ChangelogScreen = lazy(() => import('./ChangelogScreen'));

/** Réglage qui a sa propre page, ouverte depuis la liste de l'accueil. */
type SettingsPage = 'watch' | 'profiles' | 'help';

/** Page ouverte dans l'espace parent, par-dessus son accueil : celle d'une
 *  matière, d'un réglage, ou une page d'information de l'aide. La navigation
 *  (retour, geste système) vit dans App. */
export type ParentPage = Subject | SettingsPage | 'privacy' | 'changelog';

interface ParentDashboardProps {
  // Profil local actif. NULL sur un appareil qui ne fait que suivre un enfant à
  // distance : un parent peut découvrir Tablito en scannant le QR de l'appareil
  // de son enfant, sans jamais créer de profil ici.
  profile: UserProfile | null;
  // Retour de l'écran affiché : de l'accueil vers celui de l'enfant, d'une page
  // vers l'accueil de l'espace parent (cf. backTarget dans App). Absent sur
  // l'accueil quand il n'y a pas de profil local : il n'y a alors nulle part où
  // revenir, l'espace parent EST l'app.
  onBack?: () => void;
  onExport: () => void;
  // Remplace la progression du profil actif par une sauvegarde déjà lue.
  onRestore: (backup: UserProfile) => void;
  // Multi-profils : lance l'onboarding Welcome pour un nouvel enfant.
  onAddProfile: () => void;
  // Supprime le profil actif (avec confirmation côté App).
  onDeleteProfile: () => void;
  // Suivi appairé au boot depuis un `#watch=` : déjà déchiffré par main.tsx, on
  // l'affiche sans second aller-retour réseau.
  initialWatch?: WatchPairing | null;
  // Vrai quand l'espace parent est ouvert par la notification de recap
  // hebdomadaire : change la source affichée par défaut.
  openOnWatched?: boolean;
  // Page ouverte (null = accueil de l'espace parent). L'état vit dans App, avec
  // l'écran : c'est sa table de retour qui ramène d'une page à l'accueil, pour
  // le bouton comme pour le geste système. L'écran reste le même pour App, donc
  // ce composant — et ce qu'il tient (source affichée, instantané distant déjà
  // relu) — reste monté.
  page: ParentPage | null;
  onOpenPage: (page: ParentPage | null) => void;
}

// État de la relecture du suivi sélectionné ('loading' + les trois issues de
// fetchWatched : instantané, partage révoqué, échec).
type RemoteState = 'loading' | WatchFetchResult;

export default function ParentDashboard({
  profile,
  onBack,
  onExport,
  onRestore,
  onAddProfile,
  onDeleteProfile,
  initialWatch = null,
  openOnWatched = false,
  page,
  onOpenPage,
}: ParentDashboardProps) {
  const t = useParentDashboardStrings();

  // === Sources : profil local + profils suivis à distance ===
  const [watched, setWatched] = useState<WatchedProfile[]>(listWatched);
  // Source choisie : null = la progression stockée ICI, sinon le code d'un
  // suivi. Une chaîne (et non un objet) parce que c'est l'identité stable dont
  // dépend la relecture : re-cliquer l'onglet courant repose la même valeur,
  // React court-circuite le render, et aucune relecture n'est relancée.
  const [chosenCode, setChosenCode] = useState<string | null>(() => {
    // Appairage au boot : on ouvre directement sur l'enfant qu'on vient de
    // scanner, c'est la raison même de l'ouverture de l'app.
    if (initialWatch) return initialWatch.entry.code;
    // Arrivée par la notification de recap : c'est la progression SUIVIE que le
    // parent vient consulter, pas la sienne — même s'il a un profil local ici,
    // auquel cas la source par défaut serait ce profil et il faudrait encore
    // taper l'onglet de l'enfant.
    return openOnWatched ? listWatched()[0]?.code ?? null : null;
  });
  // Source affichée : le choix, tant qu'il existe encore — sinon (suivi arrêté,
  // profil local supprimé) le profil local, ou à défaut le premier enfant suivi.
  const chosenExists = chosenCode ? watched.some((w) => w.code === chosenCode) : profile !== null;
  const selectedCode = chosenExists ? chosenCode : profile ? null : watched[0]?.code ?? null;

  // L'instantané distant, ÉTIQUETÉ du code auquel il appartient : c'est ce qui
  // répond à « ai-je déjà les données de la source affichée ? » sans état de
  // coordination supplémentaire (ni drapeau « saute le premier fetch », ni
  // compteur de rafraîchissement, ni dépendance d'effet à museler).
  const [remote, setRemote] = useState<{ code: string; state: RemoteState } | null>(() =>
    initialWatch ? { code: initialWatch.entry.code, state: initialWatch.snapshot } : null,
  );

  // Code de la relecture la plus récemment lancée. Écrit hors render (dans
  // l'effet et dans le handler d'actualisation, cf. react-hooks/refs) : sert à
  // ignorer un résultat qui arrive après une bascule d'onglet, et à ne pas
  // relancer une relecture déjà en vol.
  const inFlightRef = useRef<string | null>(initialWatch?.entry.code ?? null);

  // Relecture au changement de source. La promesse est chaînée INLINE et non
  // déportée dans un useCallback : c'est la forme que la règle
  // react-hooks/set-state-in-effect accepte, et celle déjà employée par
  // usePushPref. Aucun état « chargement » n'est posé ici — l'absence
  // d'instantané pour la source affichée EST le chargement (cf. remoteState).
  useEffect(() => {
    if (!selectedCode || inFlightRef.current === selectedCode) return;
    const entry = listWatched().find((w) => w.code === selectedCode);
    if (!entry) return;
    inFlightRef.current = selectedCode;
    let cancelled = false;
    void fetchWatched(entry).then((state) => {
      if (!cancelled) setRemote({ code: selectedCode, state });
    });
    return () => {
      cancelled = true;
    };
  }, [selectedCode]);

  // « Actualiser » : même relecture, mais avec un retour visuel explicite —
  // un instantané est déjà à l'écran, donc son remplacement doit se voir. Dans un
  // handler d'événement, poser l'état est légitime (à l'inverse de l'effet).
  const refreshRemote = async (entry: WatchedProfile) => {
    inFlightRef.current = entry.code;
    setRemote({ code: entry.code, state: 'loading' });
    const state = await fetchWatched(entry);
    if (inFlightRef.current === entry.code) setRemote({ code: entry.code, state });
  };

  const watchedEntry = selectedCode
    ? watched.find((w) => w.code === selectedCode) ?? null
    : null;
  // N'est vrai que si l'état chargé correspond bien à la source affichée.
  const remoteState: RemoteState | null =
    watchedEntry && remote?.code === watchedEntry.code ? remote.state : null;
  const remoteSnapshot = typeof remoteState === 'object' ? remoteState : null;
  // Profil réellement rendu : le local, ou l'instantané de l'enfant suivi.
  const shown = watchedEntry ? remoteSnapshot?.profile ?? null : profile;
  const shownName = shown?.name ?? watchedEntry?.name ?? '';

  const sources: Array<{ code: string | null; label: string }> = [
    ...(profile ? [{ code: null, label: profile.name }] : []),
    ...watched.map((w) => ({ code: w.code as string | null, label: t.remoteSourceTab(w.name) })),
  ];

  // Appairage réussi depuis la page du suivi à distance (cf. ParentWatchPairing).
  const handlePaired = (paired: WatchPairing) => {
    setWatched(listWatched());
    // L'instantané est déjà déchiffré : on l'étiquette, et marquer le code comme
    // servi évite que l'effet relance une relecture inutile juste après.
    inFlightRef.current = paired.entry.code;
    setRemote({ code: paired.entry.code, state: paired.snapshot });
    setChosenCode(paired.entry.code);
    // Retour à l'accueil, sur l'enfant qu'on vient d'appairer : c'est lui qu'on
    // voulait voir.
    onOpenPage(null);
  };

  const handleStopWatching = (code: string) => {
    const list = removeWatched(code);
    setWatched(list);
    // Plus aucun enfant suivi : le recap hebdomadaire n'a plus rien à annoncer,
    // et sa ligne disparaît avec la liste — le laisser actif condamnerait le
    // parent à une notification hebdomadaire qu'il ne pourrait plus éteindre
    // depuis l'app.
    if (list.length === 0) void setPushPref('weekly', false);
  };

  // Page d'une matière, sur le profil affiché. Une page ne s'ouvre que depuis
  // une carte de l'accueil, qui n'existe qu'avec un profil affiché ; la clé
  // repart de zéro (niveau actif, bascules) si la source changeait dessous.
  if ((page === 'math' || page === 'conj') && shown) {
    return (
      <div className="parent-dashboard parent-dashboard--subject">
        <Header
          onBack={onBack}
          backLabel={t.backToOverview}
          eyebrow={shownName}
          title={page === 'conj' ? t.conjugations : t.math}
        />
        <ParentSubjectDetail key={selectedCode ?? 'local'} profile={shown} subject={page} />
      </div>
    );
  }

  // Pages d'information, plein écran avec leur propre en-tête. Toujours un
  // retour (vers « Aide et infos ») : cf. backTarget dans App. Leur frontière
  // de chargement est ici et non celle d'App : sous Preact, un chargement
  // suspendu recrée tout ce que sa frontière enveloppe, et l'espace parent y
  // perdrait sa source affichée.
  if ((page === 'privacy' || page === 'changelog') && onBack) {
    return (
      <Suspense fallback={null}>
        {page === 'privacy' ? <PrivacyScreen onBack={onBack} /> : <ChangelogScreen onBack={onBack} />}
      </Suspense>
    );
  }

  // Page d'un réglage. Ce qu'elles règlent tient à l'APPAREIL (ses profils, ses
  // partages, ses suivis), pas au profil affiché.
  if (page === 'watch' || page === 'help' || (page === 'profiles' && profile)) {
    const title: Record<SettingsPage, string> = {
      watch: t.watchTitle,
      profiles: t.profilesTitle,
      help: t.helpTitle,
    };
    return (
      <div className="parent-dashboard parent-dashboard--settings">
        <Header onBack={onBack} backLabel={t.backToOverview} eyebrow={t.settingsEyebrow} title={title[page]} />
        {page === 'watch' && (
          <ParentWatchPage watched={watched} onPaired={handlePaired} onStopWatching={handleStopWatching} />
        )}
        {page === 'profiles' && profile && (
          <ParentProfilesPage
            profile={profile}
            onAddProfile={onAddProfile}
            onDeleteProfile={onDeleteProfile}
            onExport={onExport}
            onRestore={onRestore}
          />
        )}
        {page === 'help' && (
          <ParentHelpPage
            feedbackProfile={shown}
            feedbackSource={
              watchedEntry ? { kind: 'watched', fetchedAt: remoteSnapshot?.updatedAt } : { kind: 'local' }
            }
            onShowChangelog={() => onOpenPage('changelog')}
            onShowPrivacy={() => onOpenPage('privacy')}
          />
        )}
      </div>
    );
  }

  return (
    <div className="parent-dashboard">
      <Header onBack={onBack} backLabel={t.back} eyebrow={t.parentArea} title={shownName} />

      {/* Sélecteur de source — n'apparaît que s'il y a vraiment un choix à
          faire. Mêmes pastilles que les onglets de « Mes images ». */}
      {sources.length > 1 && (
        <div className="progress-tabs parent-source-tabs" role="tablist" aria-label={t.sourceLabel}>
          {sources.map((item) => (
            <button
              key={item.code ?? 'local'}
              type="button"
              className={`progress-tab ${item.code === selectedCode ? 'active' : ''}`}
              onClick={() => setChosenCode(item.code)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Fraîcheur du suivi : sans elle, un appareil enfant éteint depuis une
          semaine afficherait des stats périmées sans le dire. */}
      {watchedEntry && (
        <div className="parent-remote-bar">
          {(remoteState === null || remoteState === 'loading') && (
            <span className="parent-remote-status">{t.remoteLoading}</span>
          )}
          {remoteState === 'error' && (
            <span className="parent-remote-status parent-remote-status--error">
              {t.remoteError}
            </span>
          )}
          {remoteState === 'revoked' && (
            <span className="parent-remote-status parent-remote-status--error">
              {t.remoteRevoked(watchedEntry.name)}
            </span>
          )}
          {remoteSnapshot && (
            <span className="parent-remote-status">
              {t.remoteSyncedAgo(remoteSnapshot.updatedAt)}
            </span>
          )}
          <button
            className="parent-action-btn parent-remote-refresh"
            onClick={() => void refreshRemote(watchedEntry)}
            disabled={remoteState === null || remoteState === 'loading'}
          >
            {t.remoteRefresh}
          </button>
        </div>
      )}

      {shown ? (
        <ParentOverview profile={shown} onOpenSubject={onOpenPage} />
      ) : watchedEntry ? (
        <div className="parent-section">
          <p className="parent-section-subtitle">
            {remoteState === null || remoteState === 'loading' ? t.remoteLoading : t.remoteNoData}
          </p>
        </div>
      ) : (
        // Ni profil ici ni enfant suivi (un QR périmé scanné sans Tablito) :
        // rien à montrer, et le chemin pour suivre un enfant en tête.
        <div className="parent-section">
          <div className="parent-card parent-empty">
            <p className="parent-empty-text">{t.emptyProgress}</p>
            {watchConfigured() && (
              <button className="parent-action-btn" onClick={() => onOpenPage('watch')}>
                {t.watchFollow}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Au-delà : ce qu'on règle, par opposition à ce qu'on consulte. */}
      <div className="parent-section parent-settings-start">
        <h2 className="parent-overline">{t.settings}</h2>
        <ParentSettingsList hasLocalProfile={profile !== null} watched={watched} onOpenPage={onOpenPage} />
      </div>

      {/* Appareil qui ne fait que suivre : la porte de sortie vers un profil
          local, à la place de la ligne « Profils et sauvegarde ». */}
      {!profile && (
        <div className="parent-section">
          <div className="parent-actions">
            <button className="parent-action-btn" onClick={onAddProfile}>
              {t.createLocalProfile}
            </button>
          </div>
          <p className="parent-section-subtitle parent-note">{t.profilesSubtitleWatcher}</p>
        </div>
      )}

      <div className="parent-version" aria-label={t.appVersionLabel}>
        v{APP_VERSION}
      </div>
    </div>
  );
}

interface HeaderProps {
  onBack?: () => void;
  backLabel: string;
  eyebrow: string;
  title: string;
}

// En-tête commun à l'accueil de l'espace parent et à ses pages.
function Header({ onBack, backLabel, eyebrow, title }: HeaderProps) {
  return (
    <div className="parent-header">
      {onBack && (
        <button className="parent-back-btn" onClick={onBack} aria-label={backLabel}>
          <BackChevron />
        </button>
      )}
      <div className="parent-header-titles">
        <div className="parent-eyebrow">{eyebrow}</div>
        <div className="parent-title">{title}</div>
      </div>
    </div>
  );
}
