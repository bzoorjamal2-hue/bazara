export default function Spinner({ full = false }) {
  const ring = (
    <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold-400/20 border-t-gold-400" />
  );
  if (full) {
    return <div className="flex min-h-[50vh] items-center justify-center">{ring}</div>;
  }
  return <div className="flex justify-center py-10">{ring}</div>;
}
