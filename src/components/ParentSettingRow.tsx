// Lignes des listes de réglages de l'espace parent (accueil et pages de
// réglages), à poser dans une carte-liste : `<ul className="parent-settings">`.
//
// Une ligne est soit un bouton (ouvre une page, lance une action), soit un
// lien (nouvel onglet), soit un simple conteneur quand l'action est dans la
// ligne elle-même (choix de la langue). La ligne à interrupteur a sa propre
// forme : le bouton entier EST l'interrupteur (role="switch").

import type { ReactNode } from 'react';
import BackChevron from './BackChevron';
import { ExternalIcon } from './ParentSettingIcons';

interface RowContentProps {
  icon?: ReactNode;
  title: string;
  sub?: string;
}

function RowContent({ icon, title, sub }: RowContentProps) {
  return (
    <>
      {icon && (
        <span className="parent-setting-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="parent-setting-text">
        <span className="parent-setting-title">{title}</span>
        {sub && <span className="parent-setting-sub">{sub}</span>}
      </span>
    </>
  );
}

interface SettingRowProps extends RowContentProps {
  onClick?: () => void;
  href?: string;
  // Remplace le chevron (ou le lien externe) en bout de ligne.
  trailing?: ReactNode;
  danger?: boolean;
}

export function SettingRow({ icon, title, sub, onClick, href, trailing, danger = false }: SettingRowProps) {
  const className = `parent-setting-btn${danger ? ' parent-setting-btn--danger' : ''}`;
  const content = <RowContent icon={icon} title={title} sub={sub} />;
  return (
    <li className="parent-setting">
      {href ? (
        <a className={className} href={href} target="_blank" rel="noopener noreferrer">
          {content}
          {trailing ?? (
            <span className="parent-setting-trailing" aria-hidden="true">
              <ExternalIcon />
            </span>
          )}
        </a>
      ) : onClick ? (
        <button type="button" className={className} onClick={onClick}>
          {content}
          {trailing ?? (
            <span className="parent-setting-trailing parent-setting-chevron" aria-hidden="true">
              <BackChevron />
            </span>
          )}
        </button>
      ) : (
        <div className="parent-setting-btn parent-setting-btn--static">
          {content}
          {trailing}
        </div>
      )}
    </li>
  );
}

interface SwitchRowProps extends RowContentProps {
  enabled: boolean;
  busy: boolean;
  // Erreur de la dernière bascule (permission refusée, service indisponible).
  message: string | null;
  onToggle: () => void;
}

export function SwitchRow({ icon, title, sub, enabled, busy, message, onToggle }: SwitchRowProps) {
  return (
    <li className="parent-setting">
      <button
        type="button"
        className="parent-setting-btn"
        role="switch"
        aria-checked={enabled}
        aria-busy={busy}
        disabled={busy}
        onClick={onToggle}
      >
        <RowContent icon={icon} title={title} sub={sub} />
        <span className={`notif-switch ${enabled ? 'notif-switch--on' : ''}`} aria-hidden="true">
          <span className="notif-switch-knob" />
        </span>
      </button>
      {message && <p className="notif-message">{message}</p>}
    </li>
  );
}
