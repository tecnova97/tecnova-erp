import { useQuery } from "@tanstack/react-query";
import { activityForEntityQuery } from "@/lib/module-queries";
import { profilesQuery } from "@/lib/queries";
import { fmtDateTime } from "@/lib/erp";
import { EmptyState } from "@/components/detail/parts";
import { History } from "lucide-react";

const ACTION_LABEL: Record<string, string> = {
  insert: "erstellt",
  create: "erstellt",
  created: "erstellt",
  update: "bearbeitet",
  updated: "bearbeitet",
  edit: "bearbeitet",
  delete: "gelöscht",
  archive: "archiviert",
  archived: "archiviert",
  restore: "wiederhergestellt",
  link: "verknüpft",
  unlink: "Verknüpfung entfernt",
  assign: "zugewiesen",
  return: "zurückgenommen",
  approve: "genehmigt",
  reject: "abgelehnt",
  auftrag_added: "Auftrag hinzugefügt",
  auftrag_removed: "Auftrag entfernt",
};

function actionLabel(a: string) {
  return ACTION_LABEL[a] ?? a;
}

export function VerlaufList({ entityType, entityId }: { entityType: string; entityId: string }) {
  const { data: rows = [], isLoading } = useQuery(activityForEntityQuery(entityType, entityId));
  const { data: profiles = [] } = useQuery(profilesQuery());

  const name = (id: string | null) => {
    if (!id) return "System";
    const p = profiles.find((x) => x.id === id);
    if (!p) return "Unbekannt";
    return [p.vorname, p.nachname].filter(Boolean).join(" ") || p.email || "Unbekannt";
  };

  if (isLoading) return <EmptyState>Lädt…</EmptyState>;
  if (rows.length === 0) return <EmptyState>Noch keine Aktivität aufgezeichnet.</EmptyState>;

  return (
    <ol className="relative space-y-4 border-l border-border pl-6">
      {rows.map((r) => (
        <li key={r.id} className="relative">
          <span className="absolute -left-[27px] top-1 grid h-5 w-5 place-items-center rounded-full bg-primary/10 text-primary">
            <History className="h-3 w-3" />
          </span>
          <p className="text-sm font-medium">
            {r.entity_name ? <span>{r.entity_name} </span> : null}
            {actionLabel(r.action)}
          </p>
          <p className="text-xs text-muted-foreground">
            {name(r.user_id)} · {fmtDateTime(r.created_at)}
          </p>
        </li>
      ))}
    </ol>
  );
}
