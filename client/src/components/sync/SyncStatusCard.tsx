import { type SyncOperationStatus } from '../../hooks/useSyncStatus';

export interface SyncOperationConfig {
  id: string;
  name: string;
  description: string;
  requiredKeys?: ('steam' | 'steamgrid' | 'igdb')[];
}

interface SyncStatusCardProps {
  config: SyncOperationConfig;
  status: SyncOperationStatus;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
  disabledReason?: string;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hours}h ${remainMins}m`;
}

function estimateTimeRemaining(
  completed: number,
  total: number,
  elapsedSeconds: number
): string {
  if (completed === 0 || total === 0) return 'Calculating...';
  const rate = completed / elapsedSeconds; // items per second
  const remaining = total - completed;
  const secondsRemaining = Math.ceil(remaining / rate);
  return formatDuration(secondsRemaining);
}

export default function SyncStatusCard({
  config,
  status,
  onStart,
  onStop,
  disabled = false,
  disabledReason,
}: SyncStatusCardProps) {
  const { inProgress, progress, result, elapsedSeconds } = status;

  // Calculate percentage
  const percentage =
    progress && progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : result
        ? 100
        : 0;

  // Determine status text
  let statusText = 'Not started';
  if (inProgress && progress) {
    statusText = `${progress.completed}/${progress.total}`;
    if (progress.currentGame) {
      statusText += ` - ${progress.currentGame}`;
    }
  } else if (result) {
    const parts: string[] = [];
    if (result.total !== undefined) parts.push(`${result.total} total`);
    if (result.imported !== undefined) parts.push(`${result.imported} imported`);
    if (result.updated !== undefined) parts.push(`${result.updated} updated`);
    if (result.downloaded !== undefined) parts.push(`${result.downloaded} downloaded`);
    if (result.failed !== undefined && result.failed > 0) parts.push(`${result.failed} failed`);
    if (result.skipped !== undefined && result.skipped > 0) parts.push(`${result.skipped} skipped`);
    statusText = parts.length > 0 ? parts.join(', ') : 'Complete';
  }

  // Time display
  let timeText = '';
  if (inProgress && progress && progress.total > 0) {
    const estimate = estimateTimeRemaining(
      progress.completed,
      progress.total,
      elapsedSeconds
    );
    timeText = `${formatDuration(elapsedSeconds)} elapsed, ~${estimate} remaining`;
  } else if (result && elapsedSeconds > 0) {
    timeText = `Completed in ${formatDuration(elapsedSeconds)}`;
  }

  // Background color based on state
  const bgColor = inProgress
    ? 'bg-steam-accent/10 border-steam-accent/30'
    : result
      ? 'bg-green-900/20 border-green-700/30'
      : 'bg-steam-bg-light border-steam-border';

  return (
    <div className={`rounded-lg border p-4 ${bgColor}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="text-lg font-medium text-steam-text">{config.name}</h3>
          <p className="text-sm text-steam-text-muted">{config.description}</p>
        </div>
        {/* Control Button */}
        {inProgress ? (
          <button
            onClick={onStop}
            className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={onStart}
            disabled={disabled}
            title={disabled ? disabledReason : undefined}
            className={`px-3 py-1.5 text-sm rounded transition-colors ${
              disabled
                ? 'bg-steam-border text-steam-text-muted cursor-not-allowed'
                : 'bg-steam-accent text-white hover:bg-steam-accent/80'
            }`}
          >
            Start
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-steam-bg rounded-full overflow-hidden mb-2">
        <div
          className={`h-full transition-all duration-300 ${
            inProgress ? 'bg-steam-accent' : 'bg-green-600'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Status & Time */}
      <div className="flex justify-between text-sm">
        <span className="text-steam-text truncate max-w-[60%]" title={statusText}>
          {statusText}
        </span>
        <span className="text-steam-text-muted">{timeText}</span>
      </div>

      {/* Disabled reason */}
      {disabled && disabledReason && !inProgress && (
        <p className="mt-2 text-xs text-yellow-500">{disabledReason}</p>
      )}
    </div>
  );
}
