export function ImageMessage({ url, alt }: { url: string; alt?: string | null }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl">
      <img
        src={url}
        alt={alt ?? ''}
        loading="lazy"
        className="max-h-64 w-full max-w-[260px] rounded-xl border border-black/5 object-cover transition-transform hover:scale-[1.02] dark:border-white/10"
      />
    </a>
  )
}
