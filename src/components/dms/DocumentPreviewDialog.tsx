import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createSignedUrl } from "@/lib/queries";
import { fileCategory, type DocVersion } from "@/lib/dms";
import { Download, ExternalLink, FileText, Loader2 } from "lucide-react";

export function DocumentPreviewDialog({
  version,
  open,
  onOpenChange,
  canDownload,
}: {
  version: DocVersion | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  canDownload: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (open && version) {
      setLoading(true);
      setUrl(null);
      createSignedUrl("dms", version.storage_path)
        .then((u) => { if (active) setUrl(u); })
        .finally(() => { if (active) setLoading(false); });
    }
    return () => { active = false; };
  }, [open, version]);

  const cat = version ? fileCategory(version.extension, version.mime_type) : "other";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{version?.original_dateiname ?? "Vorschau"}</DialogTitle>
        </DialogHeader>
        <div className="min-h-[60vh]">
          {loading ? (
            <div className="grid h-[60vh] place-items-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : !url ? (
            <div className="grid h-[60vh] place-items-center text-sm text-muted-foreground">Vorschau nicht verfügbar.</div>
          ) : cat === "pdf" ? (
            <iframe title="PDF" src={url} className="h-[70vh] w-full rounded-lg border border-border" />
          ) : cat === "image" ? (
            <div className="grid max-h-[70vh] place-items-center overflow-auto">
              <img src={url} alt={version?.original_dateiname ?? ""} className="max-h-[70vh] rounded-lg object-contain" />
            </div>
          ) : (
            <div className="grid h-[50vh] place-items-center gap-4 text-center">
              <FileText className="h-14 w-14 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Keine Inline-Vorschau für dieses Format</p>
                <p className="text-xs text-muted-foreground">{version?.original_dateiname}</p>
              </div>
              <Button variant="outline" onClick={() => window.open(url, "_blank")}>
                <ExternalLink className="mr-1.5 h-4 w-4" /> In neuem Tab öffnen
              </Button>
            </div>
          )}
        </div>
        {url && canDownload && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" asChild>
              <a href={url} download={version?.original_dateiname} target="_blank" rel="noreferrer">
                <Download className="mr-1.5 h-4 w-4" /> Herunterladen
              </a>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
