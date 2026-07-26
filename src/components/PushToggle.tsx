// Interrupteur d'une notification push, avec son libellé et son message
// d'erreur. Partagé par le rappel quotidien et le recap hebdomadaire : mêmes
// classes, même sémantique ARIA (role="switch"), seuls les textes changent.

interface PushToggleProps {
  enabled: boolean;
  busy: boolean;
  message: string | null;
  onToggle: () => void;
  // Libellé affiché selon l'état — « Activé ✓ » vs l'invitation à activer.
  onLabel: string;
  offLabel: string;
}

export default function PushToggle({
  enabled,
  busy,
  message,
  onToggle,
  onLabel,
  offLabel,
}: PushToggleProps) {
  return (
    <>
      <button
        type="button"
        className="notif-toggle"
        role="switch"
        aria-checked={enabled}
        aria-busy={busy}
        disabled={busy}
        onClick={onToggle}
      >
        <span className="notif-toggle-label">{enabled ? onLabel : offLabel}</span>
        <span className={`notif-switch ${enabled ? 'notif-switch--on' : ''}`} aria-hidden="true">
          <span className="notif-switch-knob" />
        </span>
      </button>
      {message && <p className="notif-message">{message}</p>}
    </>
  );
}
