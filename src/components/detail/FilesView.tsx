import { FileText, Download, ExternalLink } from "lucide-react";
import { createSignedUrl } from "@/lib/queries";
import { fmtDate } from "@/lib/erp";
import { SignedImage } from "@/components/SignedImage";
import { EmptyState } from "@/components/detail/parts";
import { Button } from "@/components/ui/button";

interface DokRow {
  id: string;
  storage_path: string;
  dateiname: string;
  created_at?: string | null;
  auftrag?: { id: string; auftragsnummer: string; titel: string } | null;
}
interface FotoRow {
  id: string;
  storage_path: string;
  dateiname: string | null;
  created_at?: string | null;
  auftrag?: { id: string; auftragsnummer: string; titel: string } | null;
}

async function open(bucket: string, path: string) {
  const url = await createSignedUrl(bucket, path);
  if (url) window.open(url, "_blank");
}

export function FotosView({ fotos }: { fotos: FotoRow[] }) {
  if (fotos.length === 0) return <EmptyState>Keine Fotos vorhanden.</EmptyState>;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
      {fotos.map((f) => (
        <button
          key={f.id}
          onClick={() => open("fotos", f.storage_path)}
          className="group relative aspect-square overflow-hidden rounded-xl border border-border"
        >
          <SignedImage bucket="fotos" path={f.storage_path} alt={f.dateiname ?? "Foto"} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
          <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-black/50 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
            <ExternalLink className="h-3 w-3" /> {f.auftrag?.auftragsnummer}
          </span>
        </button>
      ))}
    </div>
  );
}

export function DokumenteView({ dokumente }: { dokumente: DokRow[] }) {
  if (dokumente.length === 0) return <EmptyState>Keine Dokumente vorhanden.</EmptyState>;
  return (
    <div className="divide-y divide-border">
      {dokumente.map((d) => (
        <div key={d.id} className="flex items-center gap-3 py-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
            <FileText className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{d.dateiname}</p>
            <p className="text-xs text-muted-foreground">
              {d.auftrag?.auftragsnummer} · {fmtDate(d.created_at)}
            </p>
          </div>
          <Button size="icon" variant="ghost" onClick={() => open("dokumente", d.storage_path)}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
