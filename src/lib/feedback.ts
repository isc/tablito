import type { UserProfile } from '../types';
import { countMastered } from './leitner';
import { supabaseEnv, supabaseHeaders } from './supabase';
import { APP_VERSION } from './version';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const feedbackEnabled = Boolean(supabaseEnv());

export interface FeedbackContext {
  app_version: string;
  user_agent: string;
  locale: string;
  viewport: { w: number; h: number };
  stats?: {
    total_sessions: number;
    facts_mastered: number;
    facts_total: number;
    current_streak: number;
    days_since_start: number;
    // Niveau 2 : présents seulement si la division a démarré (sinon le résumé
    // resterait bruité par 64 faits jamais touchés).
    divisions_mastered?: number;
    divisions_total?: number;
  };
  // Snapshot du profil (boîtes, historique des réponses, séances), anonymisé
  // côté client : le prénom est retiré, le reste sert au débogage de cas
  // précis (« il a eu telle question alors qu'il ne maîtrise pas »).
  // Opt-in via la case à cocher du formulaire.
  profile_snapshot?: Omit<UserProfile, 'name'>;
  // D'OÙ vient le profil décrit ci-dessus. Depuis que l'avis joint le profil
  // AFFICHÉ, `user_agent`/`viewport` (l'appareil du parent) et les données de
  // l'enfant peuvent venir de deux appareils différents — et l'instantané
  // distant peut dater de plusieurs heures. Sans ces deux champs, un avis
  // « il a eu telle question » se relit sur le mauvais appareil.
  profile_source?: 'local' | 'watched';
  // Fraîcheur de l'instantané distant (ISO), quand `profile_source` vaut
  // 'watched' : l'écran l'affiche, le payload doit le dire aussi.
  profile_fetched_at?: string;
}

/** D'où vient le profil joint à l'avis : cet appareil, ou un enfant suivi. */
export interface FeedbackSource {
  kind: 'local' | 'watched';
  fetchedAt?: string;
}

export function buildContext(
  profile: UserProfile | null,
  includeFullProfile = false,
  source?: FeedbackSource,
): FeedbackContext {
  const ctx: FeedbackContext = {
    app_version: APP_VERSION,
    user_agent: navigator.userAgent,
    locale: navigator.language,
    viewport: { w: window.innerWidth, h: window.innerHeight },
  };
  if (profile) {
    const start = new Date(profile.startDate).getTime();
    const days = Math.max(0, Math.floor((Date.now() - start) / 86_400_000));
    ctx.stats = {
      total_sessions: profile.totalSessions,
      facts_mastered: countMastered(profile.facts),
      facts_total: profile.facts.length,
      current_streak: profile.currentStreak,
      days_since_start: days,
    };
    // Progression division dès qu'au moins un fait a été introduit (le niveau 2
    // est lancé), pour que le triage d'un avis post-déblocage la voie aussi.
    const divFacts = profile.divisionFacts ?? [];
    if (divFacts.some((f) => f.introduced)) {
      ctx.stats.divisions_mastered = countMastered(divFacts);
      ctx.stats.divisions_total = divFacts.length;
    }
    if (includeFullProfile) {
      const { name: _name, ...rest } = profile;
      // Profil LOCAL : c'est cet appareil qui l'a produit, et il tourne
      // maintenant — on estampe. Profil SUIVI : l'estampille vient du blob
      // publié par l'appareil de l'enfant, on la laisse telle quelle.
      ctx.profile_snapshot =
        source?.kind === 'watched' ? rest : { ...rest, appVersion: APP_VERSION };
    }
    if (source) {
      ctx.profile_source = source.kind;
      if (source.fetchedAt) ctx.profile_fetched_at = source.fetchedAt;
    }
  }
  return ctx;
}

export async function submitFeedback(args: {
  message: string;
  email?: string;
  context: FeedbackContext;
}): Promise<void> {
  if (!feedbackEnabled) throw new Error('Feedback désactivé (configuration manquante)');
  const res = await fetch(`${url}/rest/v1/feedback`, {
    method: 'POST',
    headers: { ...supabaseHeaders(publishableKey), Prefer: 'return=minimal' },
    body: JSON.stringify({
      message: args.message,
      email: args.email && args.email.trim() ? args.email.trim() : null,
      context: args.context,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(detail || `HTTP ${res.status}`);
  }
}
