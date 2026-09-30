// « Envoyer un avis », dans l'en-tête de l'accueil de l'espace parent et des
// pages matière : visible sans défiler. Rangé dans « Aide et infos », au bas de
// l'accueil puis une page plus loin, il était devenu introuvable pour poser une
// question ou signaler un souci (avis parent du 30/09/2026).

import { useState } from 'react';
import type { UserProfile } from '../types';
import type { FeedbackSource } from '../lib/feedback';
import { useParentDashboardStrings } from '../i18n/parent';
import FeedbackModal from './FeedbackModal';

interface ParentFeedbackButtonProps {
  // Le profil que l'avis joint : celui qu'on REGARDE sur l'accueil, pas celui
  // de l'appareil. Un parent qui signale un souci depuis l'onglet de son enfant
  // suivi à distance parle de l'enfant, et joindre son propre profil rendait
  // l'avis indébuggable (vécu : « 12 divisions bloquées » impossible à
  // reproduire faute du bon historique).
  //
  // null pendant « Récupération… » : surtout pas de repli sur le profil local,
  // qui serait joint sous un libellé nommant l'enfant distant. FeedbackModal
  // masque alors la case — l'avis part sans historique, ce qui est vrai.
  profile: UserProfile | null;
  source: FeedbackSource;
}

export default function ParentFeedbackButton({ profile, source }: ParentFeedbackButtonProps) {
  const t = useParentDashboardStrings();
  // Ici et non dans l'espace parent : la fenêtre se referme avec sa page, par
  // quelque chemin qu'on la quitte (geste retour compris).
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="parent-action-btn parent-feedback-btn" onClick={() => setOpen(true)}>
        {t.sendFeedback}
      </button>
      {open && <FeedbackModal profile={profile} source={source} onClose={() => setOpen(false)} />}
    </>
  );
}
