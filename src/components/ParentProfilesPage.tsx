// Page « Profils et sauvegarde » de l'espace parent : les enfants de cet
// appareil, la sauvegarde du profil actif (changer d'appareil, exporter,
// importer), et sa suppression, à part, loin des gestes du quotidien.

import { useMemo, useRef, useState } from 'react';
import type { UserProfile } from '../types';
import { getActiveProfileId, importProfile, listProfiles, loadProfileById } from '../lib/storage';
import { createTransfer, transferConfigured, TRANSFER_TTL_MINUTES } from '../lib/transfer';
import { useParentDashboardStrings } from '../i18n/parent';
import ParentQrPanel, { type QrPanelState } from './ParentQrPanel';
import { SettingList, SettingRow } from './ParentSettingRow';
import { PlusIcon } from './ParentSettingIcons';

interface ParentProfilesPageProps {
  // Profil actif de l'appareil : celui que la sauvegarde et la suppression
  // concernent.
  profile: UserProfile;
  onAddProfile: () => void;
  onDeleteProfile: () => void;
  onExport: () => void;
  // Remplace la progression du profil actif par la sauvegarde choisie.
  onRestore: (backup: UserProfile) => void;
}

export default function ParentProfilesPage({
  profile,
  onAddProfile,
  onDeleteProfile,
  onExport,
  onRestore,
}: ParentProfilesPageProps) {
  const t = useParentDashboardStrings();
  // Les enfants de l'appareil, lus une fois. Le profil actif n'est pas relu : il
  // vient de la prop, à jour après une restauration.
  const children = useMemo(() => {
    const activeId = getActiveProfileId();
    return listProfiles().map((p) => {
      const active = p.id === activeId;
      return { id: p.id, name: p.name, active, sessions: active ? 0 : loadProfileById(p.id)?.totalSessions ?? 0 };
    });
  }, []);

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
    onRestore(backup);
    setImportStatus({ ok: true, text: t.importDone(backup.name) });
  };

  return (
    <>
      <div className="parent-section">
        <h2 className="parent-overline">{t.profilesHeading}</h2>
        <SettingList>
          {children.map((child) => {
            const name = child.active ? profile.name : child.name;
            const sessions = t.sessionsCount(child.active ? profile.totalSessions : child.sessions);
            return (
              <SettingRow
                key={child.id}
                avatar={name}
                title={name}
                sub={child.active ? `${t.profileActive} · ${sessions}` : sessions}
              />
            );
          })}
          <SettingRow icon={<PlusIcon />} title={t.addChild} onClick={onAddProfile} />
        </SettingList>
      </div>

      <div className="parent-section">
        <h2 className="parent-overline">{t.backupHeading(profile.name)}</h2>
        <SettingList>
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
        </SettingList>
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
        <div className="parent-actions">
          <button className="parent-action-btn parent-action-btn--danger" onClick={onDeleteProfile}>
            {t.deleteProfile(profile.name)}
          </button>
        </div>
      </div>
    </>
  );
}
