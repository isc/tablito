// Icônes des lignes de réglages de l'espace parent : un trait, la couleur du
// texte, 20 px. Décoratives — le titre de la ligne porte le sens.

import type { ReactNode } from 'react';

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function ShareIcon() {
  return (
    <Icon>
      <circle cx="5" cy="10" r="2.2" />
      <circle cx="15" cy="4.8" r="2.2" />
      <circle cx="15" cy="15.2" r="2.2" />
      <path d="M7 9l6-3M7 11l6 3" />
    </Icon>
  );
}

export function ProfilesIcon() {
  return (
    <Icon>
      <circle cx="7.5" cy="7" r="2.8" />
      <path d="M2.5 16c.6-2.8 2.6-4.3 5-4.3s4.4 1.5 5 4.3" />
      <path d="M13 4.6a2.6 2.6 0 010 4.9M14.5 11.9c1.6.5 2.7 1.8 3 4.1" />
    </Icon>
  );
}

export function BellIcon() {
  return (
    <Icon>
      <path d="M5 13.5V9a5 5 0 0110 0v4.5l1.5 1.5h-13z" />
      <path d="M8.3 17.5a1.9 1.9 0 003.4 0" />
    </Icon>
  );
}

export function CalendarIcon() {
  return (
    <Icon>
      <rect x="3" y="4.5" width="14" height="12.5" rx="2.5" />
      <path d="M3 8.5h14M7 2.8v3.2M13 2.8v3.2" />
    </Icon>
  );
}

export function GlobeIcon() {
  return (
    <Icon>
      <circle cx="10" cy="10" r="7.2" />
      <path d="M2.8 10h14.4M10 2.8c2 2 3 4.4 3 7.2s-1 5.2-3 7.2c-2-2-3-4.4-3-7.2s1-5.2 3-7.2z" />
    </Icon>
  );
}

export function HelpIcon() {
  return (
    <Icon>
      <circle cx="10" cy="10" r="7.2" />
      <path d="M7.9 7.8a2.2 2.2 0 014.2.9c0 1.5-2.1 1.9-2.1 3.3" />
      <path d="M10 14.6h.01" />
    </Icon>
  );
}

// Lien qui s'ouvre dans un nouvel onglet (guide utilisateur).
export function ExternalIcon() {
  return (
    <Icon>
      <path d="M8 4.5H5.5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2V12M11.5 3.5h5v5M16.5 3.5L9 11" />
    </Icon>
  );
}

export function PlusIcon() {
  return (
    <Icon>
      <path d="M10 4.5v11M4.5 10h11" />
    </Icon>
  );
}
