import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { ClipboardList, RefreshCw, Loader2 } from "lucide-react";
import { auftraegeQuery } from "@/lib/queries";
import { useStatuses } from "@/lib/status";
import { useAuth } from "@/lib/auth";
import {
  useMobileWorkerSettings,
  buildDayOptions,
  isOnDay,
} from "@/lib/mobileSettings";
import { WorkerAuftragCard } from "@/components/WorkerAuftragCard";
import { RequirePermission } from "@/components/PermissionGuard";
import { PERM } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/meine-arbeit/")({
  head: () => ({ meta: [{ title: "Meine Arbeit – TecNova ERP" }] }),
  component: () => (
    <RequirePermission perm={PERM.auftraegeView}>
      <MeineArbeitPage />
    </RequirePermission>
  ),
});

function MeineArbeitPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const settings = useMobileWorkerSettings();
  const { get } = useStatuses();
  const { data: auftraege = [], isLoading, isFetching } = useQuery(auftraegeQuery());

  const days = buildDayOptions(settings);
  const [dayKey, setDayKey] = useState(days[0]?.key ?? "d0");
  const day = days.find((d) => d.key === dayKey) ?? days[0];

  const isDone = (s: string) => get(s).ist_abschluss;

  const list = auftraege
    .filter((a) => a.status !== "storniert")
    .filter((a) => (day ? isOnDay(a.termin_start, day.date) : false))
    .filter((a) => (settings.allow_completed ? true : !isDone(a.status)));

  const refresh = () => qc.invalidateQueries({ queryKey: ["auftraege"] });

  return (
    <div className="space-y-5">
      {/* Top area */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Hallo {profile?.vorname ?? ""}</p>
          <h2 className="truncate text-2xl font-extrabold tracking-tight">Meine Arbeit</h2>
          <p className="mt-0.5 text-sm capitalize text-muted-foreground">
            {format(new Date(), "EEEE, dd. MMMM yyyy", { locale: de })}
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-background text-foreground active:scale-95"
          title="Aktualisieren"
          aria-label="Aktualisieren"
        >
          <RefreshCw className={cn("h-5 w-5", isFetching && "animate-spin")} />
        </button>
      </div>

      {/* Day selector */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {days.map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => setDayKey(d.key)}
            className={cn(
              "shrink-0 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors active:scale-95",
              d.key === dayKey
                ? "border-primary bg-primary text-primary-foreground shadow-soft"
                : "border-border bg-background text-muted-foreground",
            )}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Cards */}
      {isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 py-16 text-center">
          <ClipboardList className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Keine Aufträge an diesem Tag.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((a) => (
            <WorkerAuftragCard key={a.id} auftrag={a} />
          ))}
        </div>
      )}
    </div>
  );
}
