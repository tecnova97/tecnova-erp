import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { auftraegeQuery, kundenQuery, projekteQuery, mitarbeiterQuery } from "@/lib/queries";
import { rechnungGruppenQuery } from "@/lib/abrechnung";
import { type DocEntityType, ENTITY_LABEL } from "@/lib/dms";

export interface EntityOption {
  id: string;
  label: string;
}

/**
 * Resolves human-readable names for linked entities and provides option lists
 * for the link pickers. Company/Import/Vehicle/Equipment are handled as
 * generic/singleton targets (architecture prepared for the future).
 */
export function useDmsEntities() {
  const { data: auftraege = [] } = useQuery(auftraegeQuery());
  const { data: kunden = [] } = useQuery(kundenQuery());
  const { data: projekte = [] } = useQuery(projekteQuery());
  const { data: mitarbeiter = [] } = useQuery(mitarbeiterQuery());
  const { data: gruppen = [] } = useQuery(rechnungGruppenQuery());

  const options = useMemo(() => {
    const map: Partial<Record<DocEntityType, EntityOption[]>> = {
      auftrag: auftraege.map((a) => ({ id: a.id, label: a.titel })),
      projekt: projekte.map((p) => ({ id: p.id as string, label: p.name as string })),
      auftraggeber: kunden.map((k) => ({ id: k.id as string, label: k.name as string })),
      mitarbeiter: mitarbeiter.map((m) => ({ id: m.id as string, label: `${m.vorname} ${m.nachname}`.trim() })),
      rechnung_gruppe: gruppen.map((g) => ({ id: g.id, label: g.nummer })),
      company: [{ id: "company", label: "TecNova" }],
    };
    return map;
  }, [auftraege, projekte, kunden, mitarbeiter, gruppen]);

  const lookup = useMemo(() => {
    const m = new Map<string, string>();
    const put = (t: DocEntityType, id: string, label: string) => m.set(`${t}:${id}`, label);
    auftraege.forEach((a) => put("auftrag", a.id, a.titel));
    projekte.forEach((p) => put("projekt", p.id as string, p.name as string));
    kunden.forEach((k) => put("auftraggeber", k.id as string, k.name as string));
    mitarbeiter.forEach((x) => put("mitarbeiter", x.id as string, `${x.vorname} ${x.nachname}`.trim()));
    gruppen.forEach((g) => put("rechnung_gruppe", g.id, g.nummer));
    return m;
  }, [auftraege, projekte, kunden, mitarbeiter, gruppen]);

  const nameOf = (type: DocEntityType, id: string | null): string => {
    if (type === "company") return "TecNova";
    if (!id) return ENTITY_LABEL[type];
    return lookup.get(`${type}:${id}`) ?? ENTITY_LABEL[type];
  };

  return { options, nameOf };
}
