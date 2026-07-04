import { supabase } from "@/integrations/supabase/client";

export type HistorieTyp =
  | "erstellt"
  | "status"
  | "mitarbeiter"
  | "termin"
  | "datei"
  | "foto"
  | "notiz"
  | "abschluss"
  | "bezahlt"
  | "sonstiges";

export const HISTORIE_TYP_LABEL: Record<HistorieTyp, string> = {
  erstellt: "Erstellt",
  status: "Status",
  mitarbeiter: "Mitarbeiter",
  termin: "Termin",
  datei: "Datei",
  foto: "Foto",
  notiz: "Notiz",
  abschluss: "Abschluss",
  bezahlt: "Zahlung",
  sonstiges: "Sonstiges",
};

export async function logHistorie(
  auftragId: string,
  aktion: string,
  details: string | null,
  typ: HistorieTyp = "sonstiges",
) {
  const { data: u } = await supabase.auth.getUser();
  await supabase.from("auftrag_historie").insert({
    auftrag_id: auftragId,
    aktion,
    details,
    typ,
    user_id: u.user?.id,
  } as never);
}
