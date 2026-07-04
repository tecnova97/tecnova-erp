import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fotosQuery } from "@/lib/queries";
import { SignedImage } from "@/components/SignedImage";
import { RequirePermission } from "@/components/PermissionGuard";
import { PERM } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/fotos")({
  head: () => ({ meta: [{ title: "Fotos – TecNova ERP" }] }),
  component: () => (
    <RequirePermission perm={PERM.auftraegeView}>
      <FotosPage />
    </RequirePermission>
  ),
});

function FotosPage() {
  const { data: fotos = [], isLoading } = useQuery(fotosQuery());
  if (isLoading) return <p className="text-sm text-muted-foreground">Lädt…</p>;
  if (fotos.length === 0) return <p className="text-sm text-muted-foreground">Keine Fotos vorhanden.</p>;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {fotos.map((f) => (
        <div key={f.id} className="aspect-square overflow-hidden rounded-xl border border-border">
          <SignedImage bucket="fotos" path={f.storage_path} alt={f.dateiname ?? "Foto"} className="h-full w-full object-cover" />
        </div>
      ))}
    </div>
  );
}
