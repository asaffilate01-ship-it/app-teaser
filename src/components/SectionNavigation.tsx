import { useId } from "react";
import type { LucideIcon } from "lucide-react";
export function SectionNavigation<T extends string>({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  items: Array<readonly [T, LucideIcon, string]>;
}) {
  const id = useId();
  return (
    <nav className="workspace-nav" aria-label={label}>
      <label htmlFor={id} className="workspace-nav-label lg:hidden">
        {label}
      </label>
      <select
        id={id}
        className="scorer-input lg:hidden"
        value={value}
        onChange={(e) => {
          const option = items.find((i) => i[0] === e.target.value);
          if (option) onChange(option[0]);
        }}
      >
        {items.map(([key, , text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
      <div className="hidden flex-wrap gap-2 lg:flex">
        {items.map(([key, Icon, text]) => (
          <button
            key={key}
            type="button"
            aria-current={value === key ? "page" : undefined}
            className="workspace-nav-item"
            onClick={() => onChange(key)}
          >
            <Icon className="size-4" aria-hidden="true" />
            {text}
          </button>
        ))}
      </div>
    </nav>
  );
}
