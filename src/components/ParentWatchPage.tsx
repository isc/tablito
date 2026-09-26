// Page « Suivi à distance » de l'espace parent. Les deux sens du suivi, chacun
// à sa place : partager la progression d'un enfant qui pratique ICI (un bloc
// par profil de l'appareil, et non plus seulement le profil actif), et suivre
// un enfant qui pratique ailleurs.

import { useState } from 'react';
import { startWatch, stopWatch, type WatchPairing } from '../lib/watch';
import { listProfiles, loadProfileById } from '../lib/storage';
import {
  loadWatchCredentials,
  watchLink,
  type WatchCredentials,
  type WatchedProfile,
} from '../lib/watchStore';
import { useParentDashboardStrings } from '../i18n/parent';
import ParentQrPanel, { type QrPanelState } from './ParentQrPanel';
import { SettingList, SettingRow } from './ParentSettingRow';
import ParentWatchPairing from './ParentWatchPairing';
import ProfileAvatar from './ProfileAvatar';

interface ParentWatchPageProps {
  watched: WatchedProfile[];
  onPaired: (pairing: WatchPairing) => void;
  onStopWatching: (code: string) => void;
}

export default function ParentWatchPage({ watched, onPaired, onStopWatching }: ParentWatchPageProps) {
  const t = useParentDashboardStrings();
  const [profiles] = useState(listProfiles);
  // Identifiants du partage de chaque profil. En state et non relus à chaque
  // render : startWatch/stopWatch écrivent dans localStorage sans repasser par
  // React, c'est donc ici que vit la vérité affichée.
  const [creds, setCreds] = useState<Record<string, WatchCredentials | null>>(() =>
    Object.fromEntries(profiles.map((p) => [p.id, loadWatchCredentials(p.id)])),
  );
  // Un seul QR déplié à la fois.
  const [open, setOpen] = useState<{ id: string; state: QrPanelState } | null>(null);
  const settle = (id: string, state: QrPanelState) =>
    setOpen((current) => (current?.id === id ? { id, state } : current));

  // Ouvre le partage, ou réaffiche le QR d'un partage déjà ouvert (le lien est
  // reconstruit depuis les identifiants locaux, sans redéposer d'instantané).
  // Second appui : replie le QR.
  const toggleShare = async (id: string) => {
    if (open?.id === id) {
      setOpen(null);
      return;
    }
    const existing = creds[id];
    if (existing) {
      setOpen({ id, state: { link: watchLink(existing) } });
      return;
    }
    const profile = loadProfileById(id);
    if (!profile) return;
    setOpen({ id, state: 'loading' });
    const link = await startWatch(id, profile);
    if (!link) {
      settle(id, 'error');
      return;
    }
    setCreds((c) => ({ ...c, [id]: loadWatchCredentials(id) }));
    settle(id, { link });
  };

  const stopSharing = async (id: string) => {
    setOpen((current) => (current?.id === id ? null : current));
    setCreds((c) => ({ ...c, [id]: null }));
    await stopWatch(id);
  };

  return (
    <>
      <div className="parent-section">
        <p className="parent-page-intro">{t.watchIntro}</p>
      </div>

      {profiles.length > 0 && (
        <div className="parent-section">
          <h2 className="parent-overline">{t.watchShareHeading}</h2>
          <p className="parent-section-subtitle">{t.watchShareSubtitle}</p>
          <div className="parent-share-cards">
            {profiles.map(({ id, name }) => {
              const shared = creds[id] != null;
              const panel = open?.id === id ? open.state : null;
              return (
                <div key={id} className="parent-card parent-share-card">
                  <div className="parent-share-head">
                    <ProfileAvatar name={name} className="parent-avatar" />
                    <span className="parent-share-titles">
                      <span className="parent-share-name">{name}</span>
                      <span className={`parent-share-status${shared ? ' is-on' : ''}`}>
                        {shared ? t.watchShared : t.watchNotShared}
                      </span>
                    </span>
                  </div>
                  <button className="parent-action-btn" onClick={() => void toggleShare(id)}>
                    {shared ? t.watchShowQr(name) : t.watchShare(name)}
                  </button>
                  {panel && (
                    <ParentQrPanel
                      state={panel}
                      preparing={t.watchPreparing}
                      error={t.watchShareError}
                      hint={t.watchShareHint}
                      qrAlt={t.watchQrAlt}
                      onQrError={() => settle(id, 'error')}
                    />
                  )}
                  {shared && (
                    <button className="parent-watch-remove" onClick={() => void stopSharing(id)}>
                      {t.watchStopSharing}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="parent-section">
        <h2 className="parent-overline">{t.watchFollow}</h2>
        <p className="parent-section-subtitle">{t.watchFollowSubtitle}</p>
        {watched.length > 0 && (
          <SettingList>
            {watched.map((w) => (
              <SettingRow
                key={w.code}
                avatar={w.name}
                title={w.name}
                trailing={
                  <button className="parent-watch-remove" onClick={() => onStopWatching(w.code)}>
                    {t.watchStopFollowing}
                  </button>
                }
              />
            ))}
          </SettingList>
        )}
        <ParentWatchPairing onPaired={onPaired} />
      </div>
    </>
  );
}
