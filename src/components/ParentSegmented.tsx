// Contrôle segmenté de l'espace parent : un choix parmi quelques options,
// toutes visibles. Une seule forme pour le sélecteur de niveau de la page Maths
// (pleine largeur) et la bascule réussite / rapidité (`pill`, compacte).

interface ParentSegmentedProps<T extends string> {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  pill?: boolean;
}

export default function ParentSegmented<T extends string>({
  label,
  options,
  value,
  onChange,
  pill = false,
}: ParentSegmentedProps<T>) {
  return (
    <div className={`parent-segmented${pill ? ' parent-segmented--pill' : ''}`} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`parent-segmented-option${option.value === value ? ' is-active' : ''}`}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
