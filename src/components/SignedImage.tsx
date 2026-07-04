import { useQuery } from "@tanstack/react-query";
import { createSignedUrl } from "@/lib/queries";
import { cn } from "@/lib/utils";

export function SignedImage({
  bucket,
  path,
  alt,
  className,
}: {
  bucket: string;
  path: string;
  alt: string;
  className?: string;
}) {
  const { data: url } = useQuery({
    queryKey: ["signed", bucket, path],
    queryFn: () => createSignedUrl(bucket, path),
    staleTime: 1000 * 60 * 30,
  });
  if (!url) return <div className={cn("animate-pulse bg-muted", className)} />;
  return <img src={url} alt={alt} loading="lazy" className={className} />;
}
