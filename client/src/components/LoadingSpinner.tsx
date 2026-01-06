export default function LoadingSpinner() {
  return (
    <div data-testid="loading-spinner" className="flex items-center justify-center py-8">
      <div className="w-8 h-8 border-2 border-steam-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
