interface FeedbackStarProps {
  // Étoile dorée rayonnante quand la réponse est correcte ET rapide ;
  // étoile simple sinon (cf. spec §3.3).
  fast: boolean;
}

/**
 * Étoile de feedback (correcte). Partagée par les overlays multiplication et
 * division — identique des deux côtés.
 */
export default function FeedbackStar({ fast }: FeedbackStarProps) {
  return (
    <div className="feedback-star-wrap" aria-label={fast ? 'Étoile dorée' : 'Étoile'}>
      {fast && (
        <svg width="180" height="180" viewBox="-10 -10 120 120" className="feedback-star-rays">
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
            const x1 = 50 + Math.cos(a) * 42;
            const y1 = 50 + Math.sin(a) * 42;
            const x2 = 50 + Math.cos(a) * 56;
            const y2 = 50 + Math.sin(a) * 56;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="var(--honey)"
                strokeWidth="3"
                strokeLinecap="round"
              />
            );
          })}
        </svg>
      )}
      <svg width="86" height="86" viewBox="0 0 24 24" className="feedback-star-shape">
        <path
          d="M12 2l2.6 6.3 6.8.6-5.2 4.5 1.6 6.6L12 16.8 6.2 20l1.6-6.6L2.6 8.9l6.8-.6z"
          fill="var(--honey)"
          stroke="var(--ink)"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
