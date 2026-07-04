import { useEffect, useRef, useState } from "react";
import { Upload, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Uploads a branding image to the private `branding` bucket and returns the
 * stored object path. Renders a live preview on BOTH a light and a dark
 * background so transparency issues are visible before saving. Logos always use
 * object-contain (never stretched/cropped) and no background is drawn behind
 * them, preserving alpha transparency.
 */
export function LogoUploader({
  label,
  field,
  path,
  onChange,
  accept = "image/png,image/svg+xml,image/webp,image/jpeg,image/x-icon",
  compact = false,
}: {
  label: string;
  field: string;
  path: string | null;
  onChange: (path: string | null) => void;
  accept?: string;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!path) { setPreview(null); return; }
      if (/^https?:\/\//.test(path)) { setPreview(path); return; }
      const { data } = await supabase.storage.from("branding").createSignedUrl(path, 3600);
      if (active) setPreview(data?.signedUrl ?? null);
    })();
    return () => { active = false; };
  }, [path]);

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const objectPath = `${field}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("branding")
        .upload(objectPath, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = await supabase.storage.from("branding").createSignedUrl(objectPath, 3600);
      setPreview(data?.signedUrl ?? null);
      onChange(objectPath);
      toast.success(`${label} hochgeladen.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setBusy(false);
    }
  };

  const tile = (dark: boolean) => (
    <div
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-xl border border-border",
        compact ? "h-12 w-12" : "h-20 w-20",
        dark ? "bg-[#1f2733]" : "bg-white",
      )}
      title={dark ? "Vorschau auf dunklem Hintergrund" : "Vorschau auf hellem Hintergrund"}
    >
      {preview ? (
        <img src={preview} alt={label} className="h-full w-full object-contain p-1.5" />
      ) : (
        <span className={cn("text-[10px]", dark ? "text-white/50" : "text-muted-foreground")}>leer</span>
      )}
    </div>
  );

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex flex-wrap items-center gap-3">
        {tile(false)}
        {tile(true)}
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
            Hochladen
          </Button>
          {path && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => { setPreview(null); onChange(null); }}
            >
              <X className="mr-1 h-4 w-4" /> Entfernen
            </Button>
          )}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">SVG, PNG oder WebP · transparenter Hintergrund empfohlen</p>
    </div>
  );
}
