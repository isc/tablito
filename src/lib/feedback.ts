import type { UserProfile } from '../types';
import { countMastered } from './leitner';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const feedbackEnabled = Boolean(url && publishableKey);

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
}

export function buildContext(
  profile: UserProfile | null,
  includeFullProfile = false,
): FeedbackContext {
  const ctx: FeedbackContext = {
    app_version: import.meta.env.VITE_APP_VERSION ?? 'dev',
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
      ctx.profile_snapshot = rest;
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
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${publishableKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
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
