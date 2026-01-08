interface GenresTagsCardProps {
  genres: string[];
  tags: string[];
}

export function GenresTagsCard({ genres, tags }: GenresTagsCardProps) {
  if (genres.length === 0 && tags.length === 0) {
    return null;
  }

  // Limit tags to show
  const displayTags = tags.slice(0, 8);
  const hasMoreTags = tags.length > 8;

  return (
    <div className="bg-steam-bg-card rounded-lg p-4">
      <h3 className="text-steam-text-muted text-sm font-medium mb-3 uppercase tracking-wide">
        Genres & Tags
      </h3>

      {/* Genres */}
      {genres.length > 0 && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-2">
            {genres.map((genre) => (
              <span
                key={genre}
                className="px-3 py-1 bg-steam-blue/20 text-steam-blue rounded-full text-sm font-medium"
              >
                {genre}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {displayTags.length > 0 && (
        <div>
          <div className="flex flex-wrap gap-1.5">
            {displayTags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-steam-bg/60 text-steam-text-muted rounded text-xs"
              >
                {tag}
              </span>
            ))}
            {hasMoreTags && (
              <span className="px-2 py-0.5 text-steam-text-muted text-xs">
                +{tags.length - 8} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
