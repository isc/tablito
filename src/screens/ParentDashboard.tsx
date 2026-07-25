import { useState, useEffect, useRef } from 'react';
import type { UserProfile } from '../types';
import BackChevron from '../components/BackChevron';
import FeedbackModal from '../components/FeedbackModal';
import NotificationSettings from '../components/NotificationSettings';
import LanguageToggle from '../components/LanguageToggle';
import ParentStats from '../components/ParentStats';
import QrCanvas from '../components/QrCanvas';
import { useGuideBase } from '../i18n/lang';
import { useParentDashboardStrings } from '../i18n/parent';
import { getActiveProfileId } from '../lib/storage';
import { createTransfer, transferConfigured, TRANSFER_TTL_MINUTES } from '../lib/transfer';
import {
  addWatched,
  fetchWatched,
  startWatch,
  stopWatch,
  type WatchFetchResult,
  type WatchPairing,
} from '../lib/watch';
import {
  listWatched,
  loadWatchCredentials,
  parseWatchLink,
  removeWatched,
  watchConfigured,
  watchLink,
  type WatchCredentials,
  type WatchedProfile,
} from '../lib/watchStore';
import { useQrScan } from '../hooks/useQrScan';

interface ParentDashboardProps {
  // Profil local actif. NULL sur un appareil qui ne fait que suivre un enfant à
  // distance : un parent peut découvrir Tablito en scannant le QR de l'appareil
  // de son enfant, sans jamais créer de profil ici.
  profile: UserProfile | null;
  // Absent quand il n'y a pas de profil local : il n'y a alors nulle part où
  // revenir, l'espace parent EST l'app.
  onBack?: () => void;
  onExport: () => void;
  onImport: (json: string) => void;
  // Multi-profils : lance l'onboarding Welcome pour un nouvel enfant.
  onAddProfile: () => void;
  // Supprime le profil actif (avec confirmation côté App).
  onDeleteProfile: () => void;
  onShowPrivacy: () => void;
  onShowChangelog: () => void;
  // Suivi appairé au boot depuis un `#watch=` : déjà déchiffré par main.tsx, on
  // l'affiche sans second aller-retour réseau.
  initialWatch?: WatchPairing | null;
}

// État de la relecture du suivi sélectionné ('loading' + les trois issues de
// fetchWatched : instantané, partage révoqué, échec).
type RemoteState = 'loading' | WatchFetchResult;

// Cible d'un « Copié ✓ » — un seul état pour les trois boutons qui copient.
type CopyTarget = 'app' | 'transfer' | 'watch';

// État du partage de la progression locale (côté appareil de l'enfant) — un
// seul état, l'objet {link} valant « partagé, QR affichable ».
type ShareState = 'idle' | 'loading' | 'error' | { link: string };

export default function ParentDashboard({
  profile,
  onBack,
  onExport,
  onImport,
  onAddProfile,
  onDeleteProfile,
  onShowPrivacy,
  onShowChangelog,
  initialWatch = null,
}: ParentDashboardProps) {
  const t = useParentDashboardStrings();
  const guideBase = useGuideBase();

  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  // Un seul drapeau « Copié ✓ » pour les trois boutons qui copient un lien.
  const [copied, setCopied] = useState<CopyTarget | null>(null);
  // Transfert vers un autre appareil : un seul état, l'objet {link} valant
  // « prêt, QR à afficher » (cf. lib/transfer) — aucune combinaison incohérente
  // possible entre statut et lien.
  const [transfer, setTransfer] = useState<ShareState>('idle');
  const transferLink = typeof transfer === 'object' ? transfer.link : null;

  const profileId = getActiveProfileId();

  // === Sources : profil local + profils suivis à distance ===
  const [watched, setWatched] = useState<WatchedProfile[]>(listWatched);
  // Source affichée : null = la progression stockée ICI, sinon le code d'un
  // suivi. Une chaîne (et non un objet) parce que c'est l'identité stable dont
  // dépend la relecture : re-cliquer l'onglet courant repose la même valeur,
  // React court-circuite le render, et aucune relecture n'est relancée.
  const [selectedCode, setSelectedCode] = useState<string | null>(() => {
    // Appairage au boot : on ouvre directement sur l'enfant qu'on vient de
    // scanner, c'est la raison même de l'ouverture de l'app.
    if (initialWatch) return initialWatch.entry.code;
    if (profile) return null;
    return listWatched()[0]?.code ?? null;
  });

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
  // NotificationSettings. Aucun état « chargement » n'est posé ici — l'absence
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
  // Profil réellement rendu par ParentStats.
  const shown = watchedEntry ? remoteSnapshot?.profile ?? null : profile;
  const shownName = shown?.name ?? watchedEntry?.name ?? '';

  const sources: Array<{ code: string | null; label: string }> = [
    ...(profile ? [{ code: null, label: profile.name }] : []),
    ...watched.map((w) => ({ code: w.code as string | null, label: t.remoteSourceTab(w.name) })),
  ];

  // === Partage de la progression locale (appareil de l'enfant) ===
  const [share, setShare] = useState<ShareState>('idle');
  const shareLink = typeof share === 'object' ? share.link : null;
  // Identifiants du partage déjà ouvert (possiblement lors d'une session
  // précédente). En state et non relus à chaque render : startWatch/stopWatch
  // écrivent dans localStorage sans repasser par React, donc c'est ici que vit
  // la vérité affichée — sinon « Ne plus partager » laisse le bouton continuer à
  // proposer « Revoir le QR code » jusqu'au prochain render fortuit.
  const [sharedCreds, setSharedCreds] = useState<WatchCredentials | null>(() =>
    profileId ? loadWatchCredentials(profileId) : null,
  );

  // === Appairage d'un suivi (appareil du parent) ===
  type PairState = 'idle' | 'scanning' | 'fetching' | 'cameraError' | 'linkError' | 'manual';
  const [pair, setPair] = useState<PairState>('idle');
  const [pairText, setPairText] = useState('');

  const acceptWatchLink = async (text: string): Promise<boolean> => {
    if (!parseWatchLink(text)) return false;
    setPair('fetching');
    const paired = await addWatched(text);
    if (!paired) {
      setPair('linkError');
      return true; // lien reconnu mais illisible : inutile de continuer à filmer
    }
    setWatched(listWatched());
    // L'instantané est déjà déchiffré : on l'étiquette, et marquer le code comme
    // servi évite que l'effet relance une relecture inutile juste après.
    inFlightRef.current = paired.entry.code;
    setRemote({ code: paired.entry.code, state: paired.snapshot });
    setSelectedCode(paired.entry.code);
    setPair('idle');
    return true;
  };

  const scanVideoRef = useQrScan({
    active: pair === 'scanning',
    onCode: acceptWatchLink,
    onCameraError: () => setPair('cameraError'),
  });

  // « Copié ✓ » pendant 2 s. Échec silencieux : clipboard indisponible (contexte
  // non sécurisé), l'utilisateur a d'autres chemins (QR, feuille de partage).
  const copyWithFeedback = async (text: string, target: CopyTarget) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(target);
      setTimeout(() => setCopied((c) => (c === target ? null : c)), 2000);
    } catch {
      // ignore
    }
  };

  const handleShareApp = async () => {
    const url = window.location.origin + import.meta.env.BASE_URL;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Tablito', text: t.shareText, url });
      } catch {
        // Annulation utilisateur : pas de fallback clipboard, sinon on copie
        // un lien que l'utilisateur a explicitement refusé de partager.
      }
      return;
    }
    await copyWithFeedback(url, 'app');
  };

  const handleTransfer = async () => {
    if (transfer !== 'idle') {
      // Second clic : replie le panneau. Le code déposé expirera tout seul.
      setTransfer('idle');
      return;
    }
    if (!profile) return;
    setTransfer('loading');
    const link = await createTransfer(profile);
    setTransfer(link ? { link } : 'error');
  };

  // Ouvre le partage, ou réaffiche le QR d'un partage déjà ouvert (le lien est
  // reconstruit depuis les identifiants locaux, sans redéposer d'instantané).
  const handleShareProgress = async () => {
    if (share !== 'idle') {
      setShare('idle');
      return;
    }
    if (!profile || !profileId) return;
    if (sharedCreds) {
      setShare({ link: watchLink(sharedCreds) });
      return;
    }
    setShare('loading');
    const link = await startWatch(profileId, profile);
    if (!link) {
      setShare('error');
      return;
    }
    setSharedCreds(loadWatchCredentials(profileId));
    setShare({ link });
  };

  const handleStopSharing = async () => {
    if (!profileId) return;
    setShare('idle');
    setSharedCreds(null);
    await stopWatch(profileId);
  };

  const handleImport = () => {
    if (importJson.trim()) {
      onImport(importJson.trim());
      setShowImport(false);
      setImportJson('');
    }
  };

  const handleStopWatching = (code: string) => {
    const list = removeWatched(code);
    setWatched(list);
    // Le suivi affiché disparaît : on retombe sur le profil local, ou à défaut
    // sur un autre enfant suivi.
    if (selectedCode === code) setSelectedCode(profile ? null : list[0]?.code ?? null);
  };

  // Sections qui n'ont de sens que sur la progression stockée ICI : sauvegarde,
  // transfert, rappels, suppression de profil. Sur un profil suivi à distance,
  // elles parleraient d'un appareil qu'on n'a pas en main.
  const localSelected = selectedCode === null && profile !== null;

  return (
    <div className="parent-dashboard">
      <div className="parent-header">
        {onBack && (
          <button className="parent-back-btn" onClick={onBack} aria-label={t.back}>
            <BackChevron />
          </button>
        )}
        <div className="parent-header-titles">
          <div className="parent-eyebrow">{t.parentArea}</div>
          <div className="parent-title">{t.profileSuffix(shownName)}</div>
        </div>
      </div>

      {/* Sélecteur de source — n'apparaît que s'il y a vraiment un choix à
          faire. Mêmes classes que le sélecteur d'opération. */}
      {sources.length > 1 && (
        <div className="progress-tabs parent-op-tabs" role="tablist" aria-label={t.sourceLabel}>
          {sources.map((item) => (
            <button
              key={item.code ?? 'local'}
              type="button"
              className={`progress-tab ${item.code === selectedCode ? 'active' : ''}`}
              onClick={() => setSelectedCode(item.code)}
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
        <ParentStats profile={shown} />
      ) : (
        <div className="parent-section">
          <p className="parent-section-subtitle">
            {remoteState === null || remoteState === 'loading' ? t.remoteLoading : t.remoteNoData}
          </p>
        </div>
      )}

      {/* Actions de sauvegarde — propres à la progression stockée ici. */}
      {localSelected && (
        <div className="parent-section">
          <h3>{t.backup}</h3>
          <div className="parent-actions">
            {transferConfigured() && (
              <button className="parent-action-btn" onClick={handleTransfer}>
                {t.transfer}
              </button>
            )}
            <button className="parent-action-btn" onClick={onExport}>
              {t.export}
            </button>
            <button className="parent-action-btn" onClick={() => setShowImport(!showImport)}>
              {t.import}
            </button>
          </div>
          {transfer !== 'idle' && (
            <div className="parent-transfer-area">
              {transfer === 'loading' && (
                <p className="parent-transfer-status">{t.transferPreparing}</p>
              )}
              {transfer === 'error' && (
                <p className="parent-transfer-status parent-transfer-status--error">
                  {t.transferError}
                </p>
              )}
              {transferLink && (
                <>
                  <QrCanvas
                    value={transferLink}
                    className="parent-transfer-qr"
                    ariaLabel={t.transferQrAlt}
                    onError={() => setTransfer('error')}
                  />
                  <p className="parent-transfer-hint">{t.transferHint(TRANSFER_TTL_MINUTES)}</p>
                  <button
                    className="parent-action-btn"
                    onClick={() => void copyWithFeedback(transferLink, 'transfer')}
                  >
                    {copied === 'transfer' ? t.linkCopied : t.transferCopyLink}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Suivi à distance — les deux sens : partager la progression de cet
          appareil, et suivre celle d'un autre. */}
      {watchConfigured() && (
        <div className="parent-section">
          <h3>{t.watchTitle}</h3>
          <p className="parent-section-subtitle">{t.watchSubtitle}</p>

          {localSelected && (
            <div className="parent-watch-block">
              <div className="parent-actions">
                <button className="parent-action-btn" onClick={handleShareProgress}>
                  {sharedCreds ? t.watchShowQr(profile.name) : t.watchShare(profile.name)}
                </button>
                {sharedCreds && (
                  <button
                    className="parent-action-btn parent-action-btn--danger"
                    onClick={handleStopSharing}
                  >
                    {t.watchStopSharing}
                  </button>
                )}
              </div>
              {share !== 'idle' && (
                <div className="parent-transfer-area">
                  {share === 'loading' && (
                    <p className="parent-transfer-status">{t.watchPreparing}</p>
                  )}
                  {share === 'error' && (
                    <p className="parent-transfer-status parent-transfer-status--error">
                      {t.watchShareError}
                    </p>
                  )}
                  {shareLink && (
                    <>
                      <QrCanvas
                        value={shareLink}
                        className="parent-transfer-qr"
                        ariaLabel={t.watchQrAlt}
                        onError={() => setShare('error')}
                      />
                      <p className="parent-transfer-hint">{t.watchShareHint}</p>
                      <button
                        className="parent-action-btn"
                        onClick={() => void copyWithFeedback(shareLink, 'watch')}
                      >
                        {copied === 'watch' ? t.linkCopied : t.transferCopyLink}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="parent-watch-block">
            {pair === 'scanning' || pair === 'fetching' ? (
              <>
                <video ref={scanVideoRef} className="parent-scan-video" />
                <p className="parent-transfer-status">
                  {pair === 'fetching' ? t.remoteLoading : t.watchScanPrompt}
                </p>
                <button className="parent-action-btn" onClick={() => setPair('idle')}>
                  {t.cancel}
                </button>
              </>
            ) : (
              <>
                {pair === 'cameraError' && (
                  <p className="parent-transfer-status parent-transfer-status--error">
                    {t.watchCameraError}
                  </p>
                )}
                {pair === 'linkError' && (
                  <p className="parent-transfer-status parent-transfer-status--error">
                    {t.watchLinkError}
                  </p>
                )}
                <div className="parent-actions">
                  <button className="parent-action-btn" onClick={() => setPair('scanning')}>
                    {t.watchScanQr}
                  </button>
                  <button className="parent-action-btn" onClick={() => setPair('manual')}>
                    {t.watchPasteLink}
                  </button>
                </div>
              </>
            )}
            {pair === 'manual' && (
              <div className="parent-import-area">
                <textarea
                  className="parent-import-textarea"
                  placeholder={t.watchPastePlaceholder}
                  value={pairText}
                  onChange={(e) => setPairText((e.target as HTMLTextAreaElement).value)}
                />
                <button
                  className="parent-import-confirm"
                  disabled={!pairText.trim()}
                  onClick={async () => {
                    if (!(await acceptWatchLink(pairText.trim()))) setPair('linkError');
                    setPairText('');
                  }}
                >
                  {t.watchPasteConfirm}
                </button>
              </div>
            )}
          </div>

          {watched.length > 0 && (
            <div className="parent-watch-list">
              {watched.map((w) => (
                <div key={w.code} className="parent-watch-row">
                  <span className="parent-watch-name">{w.name}</span>
                  <button
                    className="parent-watch-remove"
                    onClick={() => handleStopWatching(w.code)}
                  >
                    {t.watchStopFollowing}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="parent-section">
        <h3>{t.helpAndFeedback}</h3>
        <div className="parent-actions">
          <a
            className="parent-action-btn"
            href={guideBase}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.userGuide}
          </a>
          <button className="parent-action-btn" onClick={() => setShowFeedback(true)}>
            {t.sendFeedback}
          </button>
        </div>
      </div>

      {localSelected && <NotificationSettings />}

      <div className="parent-section">
        <h3>{t.shareTablito}</h3>
        <p className="parent-section-subtitle">{t.shareSubtitle}</p>
        <div className="parent-actions">
          <button className="parent-action-btn" onClick={handleShareApp}>
            {copied === 'app' ? t.linkCopied : t.shareApp}
          </button>
        </div>
      </div>

      <div className="parent-section">
        <LanguageToggle />
      </div>

      <div className="parent-section">
        <h3>{t.about}</h3>
        <div className="parent-actions">
          <button className="parent-action-btn" onClick={onShowChangelog}>
            {t.whatsNew}
          </button>
          <button className="parent-action-btn" onClick={onShowPrivacy}>
            {t.privacy}
          </button>
        </div>
      </div>

      <div className="parent-section">
        <h3>{t.profiles}</h3>
        <p className="parent-section-subtitle">
          {localSelected && profile
            ? t.profilesSubtitle(profile.name)
            : t.profilesSubtitleWatcher}
        </p>
        <div className="parent-actions">
          <button className="parent-action-btn" onClick={onAddProfile}>
            {profile ? t.addChild : t.createLocalProfile}
          </button>
          {localSelected && (
            <button
              className="parent-action-btn parent-action-btn--danger"
              onClick={onDeleteProfile}
            >
              {t.deleteThisProfile}
            </button>
          )}
        </div>
      </div>

      {showImport && (
        <div className="parent-import-area">
          <textarea
            className="parent-import-textarea"
            placeholder={t.pasteJsonHere}
            value={importJson}
            onChange={(e) => setImportJson((e.target as HTMLTextAreaElement).value)}
          />
          <button
            className="parent-import-confirm"
            onClick={handleImport}
            disabled={!importJson.trim()}
          >
            {t.confirmImport}
          </button>
        </div>
      )}

      {showFeedback && (
        <FeedbackModal profile={profile} onClose={() => setShowFeedback(false)} />
      )}

      <div className="parent-version" aria-label={t.appVersionLabel}>
        v{import.meta.env.VITE_APP_VERSION}
      </div>
    </div>
  );
}
