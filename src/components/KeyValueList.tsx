interface KeyValueItem {
  label: string;
  value: unknown;
}

interface KeyValueListProps {
  items: KeyValueItem[];
  emptyText: string;
}

function stringifyValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export function KeyValueList({ items, emptyText }: KeyValueListProps) {
  const rows = items
    .map((item) => ({ label: item.label, value: stringifyValue(item.value) }))
    .filter((item) => item.value.length > 0);

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="space-y-2 text-sm">
      {rows.map((item) => (
        <div key={item.label} className="flex justify-between gap-4">
          <span className="text-muted-foreground">{item.label}</span>
          <span className="text-right">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
