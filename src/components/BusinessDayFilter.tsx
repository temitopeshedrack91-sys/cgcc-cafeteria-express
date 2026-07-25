import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  addDays,
  currentBusinessDay,
  labelForFilter,
  type BusinessDayFilter,
  type FilterMode,
} from "@/lib/business-day";

type Props = {
  value: BusinessDayFilter;
  onChange: (next: BusinessDayFilter) => void;
  className?: string;
  /** Show include-archived toggle. Default true. */
  allowArchived?: boolean;
};

const MODES: { mode: FilterMode; label: string }[] = [
  { mode: "today", label: "Today" },
  { mode: "yesterday", label: "Yesterday" },
  { mode: "date", label: "Select date" },
  { mode: "range", label: "Date range" },
  { mode: "all", label: "All history" },
];

export function BusinessDayFilter({
  value,
  onChange,
  className,
  allowArchived = true,
}: Props) {
  const today = currentBusinessDay();

  const setMode = (mode: FilterMode) => {
    if (mode === "date") {
      onChange({ mode, date: value.date ?? today, includeArchived: value.includeArchived });
    } else if (mode === "range") {
      onChange({
        mode,
        from: value.from ?? addDays(today, -6),
        to: value.to ?? today,
        includeArchived: value.includeArchived,
      });
    } else {
      onChange({ mode, includeArchived: value.includeArchived });
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
          {labelForFilter(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3 p-3">
        <div className="grid grid-cols-2 gap-1">
          {MODES.map((m) => (
            <Button
              key={m.mode}
              size="sm"
              variant={value.mode === m.mode ? "default" : "outline"}
              onClick={() => setMode(m.mode)}
            >
              {m.label}
            </Button>
          ))}
        </div>

        {value.mode === "date" && (
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">
              Date
            </label>
            <Input
              type="date"
              value={value.date ?? today}
              max={today}
              onChange={(e) => onChange({ ...value, date: e.target.value })}
            />
          </div>
        )}

        {value.mode === "range" && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">
                From
              </label>
              <Input
                type="date"
                value={value.from ?? today}
                max={today}
                onChange={(e) => onChange({ ...value, from: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">
                To
              </label>
              <Input
                type="date"
                value={value.to ?? today}
                max={today}
                onChange={(e) => onChange({ ...value, to: e.target.value })}
              />
            </div>
          </div>
        )}

        {allowArchived && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={value.includeArchived ?? false}
              onChange={(e) =>
                onChange({ ...value, includeArchived: e.target.checked })
              }
            />
            Include archived (closed) days
          </label>
        )}
      </PopoverContent>
    </Popover>
  );
}
