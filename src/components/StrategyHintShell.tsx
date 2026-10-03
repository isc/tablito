import type { ReactNode } from 'react';

interface StrategyHintShellProps {
  title: string;
  // Lignes du corps : du texte, ou un nœud riche (ex : la case à facteur
  // manquant de la division). Multiplication passe simplement des strings.
  lines?: ReactNode[];
  // Corps libre sous les lignes (ex : la règle de conjugaison en images).
  children?: ReactNode;
  variant: 'feedback' | 'intro';
  // En-tête de la carte feedback (« L'astuce du ×9 », « L'astuce »).
  eyebrow?: string;
  // Rappel additionnel affiché en intro (ex : la règle ×10 pour les ×9).
  recall?: string;
  // Bouton en bout d'en-tête (ex : « Écouter » des règles de conjugaison).
  action?: ReactNode;
}

function BulbIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2 L 12 5 M 5 7 L 7 9 M 19 7 L 17 9 M 8 14 C 8 10, 16 10, 16 14 L 15 18 L 9 18 Z M 10 20 L 14 20"
        stroke="var(--ink)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Coquille présentationnelle partagée par StrategyHint (multiplication) et
 * DivisionStrategyHint. Chaque variante d'opération fournit son titre, ses
 * lignes, et ses éléments spécifiques (eyebrow, recall).
 */
export default function StrategyHintShell({
  title,
  lines,
  children,
  variant,
  eyebrow,
  recall,
  action,
}: StrategyHintShellProps) {
  const lineEls = lines && (
    <div className="strategy-hint-lines">
      {lines.map((line, i) => (
        <div key={i} className="strategy-hint-line">{line}</div>
      ))}
    </div>
  );

  if (variant === 'intro') {
    return (
      <div className="strategy-hint intro">
        <div className="strategy-hint-head">
          <div className="strategy-hint-icon" aria-hidden>
            <BulbIcon />
          </div>
          <div className="strategy-hint-title">{title}</div>
          {action}
        </div>
        {lineEls}
        {children}
        {recall && <div className="strategy-hint-recall">{recall}</div>}
      </div>
    );
  }

  return (
    <div className="strategy-hint feedback">
      <div className="strategy-hint-top">
        <div>
          <div className="strategy-hint-eyebrow">{eyebrow}</div>
          <div className="strategy-hint-body">{title}</div>
        </div>
        {action}
      </div>
      {lineEls}
      {children}
    </div>
  );
}
