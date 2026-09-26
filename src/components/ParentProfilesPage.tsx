// Page « Profils et sauvegarde » de l'espace parent : les enfants de cet
// appareil, la sauvegarde du profil actif (changer d'appareil, exporter,
// importer), et sa suppression, à part, loin des gestes du quotidien.

import { useMemo, useRef, useState } from 'react';
import type { UserProfile } from '../types';
import { getActiveProfileId, importProfile, listProfiles, loadProfileById } from '../lib/storage';
import { createTransfer, transferConfigured, TRANSFER_TTL_MINUTES } from '../lib/transfer';
import { useParentDashboardStrings } from '../i18n/parent';
import ParentQrPanel, { type QrPanelState } from './ParentQrPanel';
import { SettingRow } from './ParentSettingRow';
import { PlusIcon } from './ParentSettingIcons';

interface ParentProfilesPageProps {
  // Profil actif de l'appareil : celui que la sauvegarde et la suppression
  // concernent.
  profile: UserProfile;
  onAddProfile: () => void;
  onDeleteProfile: () => void;
  onExport: () => void;
  // Remplace la progression du profil actif ; null si le JSON n'est pas une
  // sauvegarde lisible.
  onImport: (json: string) => UserProfile | null;
}

export default function ParentProfilesPage({
  profile,
  onAddProfile,
  onDeleteProfile,
  onExport,
  onImport,
}: ParentProfilesPageProps) {
  const t = useParentDashboardStrings();
  const activeId = getActiveProfileId();
  // Les autres enfants, lus une fois ; le profil actif vient de la prop, à jour
  // après un import.
  const children = useMemo(
    () =>
      listProfiles().map((p) => ({
        id: p.id,
        name: p.name,
        sessions: loadProfileById(p.id)?.totalSessions ?? 0,
      })),
    [],
  );

  // Transfert vers un nouvel appareil : second appui sur la ligne, le QR se
  // replie (le code déposé expirera tout seul).
  const [transfer, setTransfer] = useState<QrPanelState | null>(null);
  const handleTransfer = async () => {
    if (transfer) {
      setTransfer(null);
      return;
    }
    setTransfer('loading');
    const link = await createTransfer(profile);
    setTransfer((current) => (current === 'loading' ? (link ? { link } : 'error') : current));
  };

  // Import par fichier : le pendant du fichier que produit l'export.
  const fileRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const handleFile = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    // Remis à zéro pour que choisir à nouveau le même fichier relance l'import.
    input.value = '';
    if (!file) return;
    const json = await file.text();
    const backup = importProfile(json);
    if (!backup) {
      setImportStatus({ ok: false, text: t.importInvalid });
      return;
    }
    const confirmed = window.confirm(
      t.importConfirm(profile.name, backup.name, t.sessionsCount(backup.totalSessions)),
    );
    if (!confirmed) return;
    const imported = onImport(json);
    setImportStatus(
      imported ? { ok: true, text: t.importDone(imported.name) } : { ok: false, text: t.importInvalid },
    );
  };

  return (
    <>
      <div className="parent-section">
        <h2 className="parent-overline">{t.profilesHeading}</h2>
        <div className="parent-card parent-card--list">
          <ul className="parent-settings">
            {children.map((child) => {
              const active = child.id === activeId;
              const name = active ? profile.name : child.name;
              const sessions = t.sessionsCount(active ? profile.totalSessions : child.sessions);
              return (
                <SettingRow
                  key={child.id}
                  icon={name.charAt(0).toUpperCase()}
                  title={name}
                  sub={active ? `${t.profileActive} · ${sessions}` : sessions}
                />
              );
            })}
            <SettingRow icon={<PlusIcon />} title={t.addChild} onClick={onAddProfile} />
          </ul>
        </div>
      </div>

      <div className="parent-section">
        <h2 className="parent-overline">{t.backupHeading(profile.name)}</h2>
        <div className="parent-card parent-card--list">
          <ul className="parent-settings">
            {transferConfigured() && (
              <SettingRow
                title={t.transferRowTitle}
                sub={t.transferRowSubtitle(TRANSFER_TTL_MINUTES)}
                onClick={() => void handleTransfer()}
              />
            )}
            <SettingRow title={t.exportRowTitle} sub={t.exportRowSubtitle} onClick={onExport} />
            <SettingRow
              title={t.importRowTitle}
              sub={t.importRowSubtitle(profile.name)}
              onClick={() => fileRef.current?.click()}
            />
          </ul>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="parent-import-input"
          hidden
          onChange={(e) => void handleFile(e.currentTarget as HTMLInputElement)}
        />
        {transfer && (
          <ParentQrPanel
            state={transfer}
            preparing={t.transferPreparing}
            error={t.transferError}
            hint={t.transferHint(TRANSFER_TTL_MINUTES)}
            qrAlt={t.transferQrAlt}
            onQrError={() => setTransfer('error')}
          />
        )}
        {importStatus && (
          <p
            className={`parent-import-status${importStatus.ok ? '' : ' parent-import-status--error'}`}
            role="status"
          >
            {importStatus.text}
          </p>
        )}
      </div>

      <div className="parent-section parent-danger">
        <p className="parent-section-subtitle">{t.deleteProfileHint}</p>
        <button className="parent-action-btn parent-action-btn--danger" onClick={onDeleteProfile}>
          {t.deleteProfile(profile.name)}
        </button>
      </div>
    </>
  );
}
