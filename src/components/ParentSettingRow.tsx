// Lignes des listes de réglages de l'espace parent (accueil et pages de
// réglages), posées dans leur carte-liste (SettingList).
//
// Une ligne est soit un bouton (ouvre une page, lance une action), soit un
// lien (nouvel onglet), soit un simple conteneur quand ce qu'on manipule est
// au bout de la ligne (choix de la langue, « Ne plus suivre »). La ligne à
// interrupteur a sa propre forme : le bouton entier EST l'interrupteur
// (role="switch").

import type { ReactNode } from 'react';
import { ForwardChevron } from './BackChevron';
import { ExternalIcon } from './ParentSettingIcons';
import ProfileAvatar from './ProfileAvatar';

export function SettingList({ children }: { children: ReactNode }) {
  return (
    <div className="parent-card parent-card--list">
      <ul className="parent-settings">{children}</ul>
    </div>
  );
}

interface RowContentProps {
  icon?: ReactNode;
  // Ligne d'un enfant : sa pastille à la place de l'icône.
  avatar?: string;
  title: string;
  sub?: string;
}

function RowContent({ icon, avatar, title, sub }: RowContentProps) {
  return (
    <>
      {avatar ? (
        <ProfileAvatar name={avatar} className="parent-setting-icon parent-setting-avatar" />
      ) : (
        icon && (
          <span className="parent-setting-icon" aria-hidden="true">
            {icon}
          </span>
        )
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
  // Au bout d'une ligne sans action propre : ce qu'on y manipule.
  trailing?: ReactNode;
}

export function SettingRow({ onClick, href, trailing, ...content }: SettingRowProps) {
  return (
    <li className="parent-setting">
      {href ? (
        <a className="parent-setting-btn" href={href} target="_blank" rel="noopener noreferrer">
          <RowContent {...content} />
          <span className="parent-setting-trailing" aria-hidden="true">
            <ExternalIcon />
          </span>
        </a>
      ) : onClick ? (
        <button type="button" className="parent-setting-btn" onClick={onClick}>
          <RowContent {...content} />
          <span className="parent-setting-trailing" aria-hidden="true">
            <ForwardChevron />
          </span>
        </button>
      ) : (
        <div className="parent-setting-btn parent-setting-btn--static">
          <RowContent {...content} />
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

export function SwitchRow({ enabled, busy, message, onToggle, ...content }: SwitchRowProps) {
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
        <RowContent {...content} />
        <span className={`notif-switch ${enabled ? 'notif-switch--on' : ''}`} aria-hidden="true">
          <span className="notif-switch-knob" />
        </span>
      </button>
      {message && <p className="notif-message">{message}</p>}
    </li>
  );
}
