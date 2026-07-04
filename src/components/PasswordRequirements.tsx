import { Check, X } from "lucide-react";
import { passwordChecks } from "@/lib/password";
import { cn } from "@/lib/utils";

/** Live checklist of the password policy; fulfilled rules show a green check. */
export function PasswordRequirements({ value }: { value: string }) {
  const checks = passwordChecks(value);
  return (
    <ul className="space-y-1.5 rounded-lg border border-border bg-muted/40 p-3">
      {checks.map(({ rule, ok }) => (
        <li
          key={rule.id}
          className={cn(
            "flex items-center gap-2 text-xs transition-colors",
            ok ? "text-success" : "text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "grid h-4 w-4 shrink-0 place-items-center rounded-full",
              ok ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
            )}
          >
            {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          </span>
          {rule.label}
        </li>
      ))}
    </ul>
  );
}
