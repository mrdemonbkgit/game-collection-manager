import DOMPurify from 'dompurify';

interface AboutCardProps {
  description: string | null;
  shortDescription?: string | null;
  developer?: string | null;
  publisher?: string | null;
  releaseDate?: string | null;
}

export function AboutCard({
  description,
  shortDescription,
  developer,
  publisher,
  releaseDate,
}: AboutCardProps) {
  const displayText = description || shortDescription;

  if (!displayText && !developer && !publisher && !releaseDate) {
    return null;
  }

  // Sanitize HTML content
  const sanitizedHtml = displayText
    ? DOMPurify.sanitize(displayText, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'a'],
        ALLOWED_ATTR: ['href', 'target', 'rel'],
      })
    : null;

  // Format release date
  const formattedDate = releaseDate
    ? new Date(releaseDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <div className="bg-steam-bg-card rounded-lg p-4">
      <h3 className="text-steam-text-muted text-sm font-medium mb-3 uppercase tracking-wide">
        About This Game
      </h3>

      {/* Metadata */}
      {(developer || publisher || formattedDate) && (
        <div className="flex flex-wrap gap-x-6 gap-y-2 mb-4 text-sm">
          {developer && (
            <div>
              <span className="text-steam-text-muted">Developer: </span>
              <span className="text-steam-text">{developer}</span>
            </div>
          )}
          {publisher && (
            <div>
              <span className="text-steam-text-muted">Publisher: </span>
              <span className="text-steam-text">{publisher}</span>
            </div>
          )}
          {formattedDate && (
            <div>
              <span className="text-steam-text-muted">Release Date: </span>
              <span className="text-steam-text">{formattedDate}</span>
            </div>
          )}
        </div>
      )}

      {/* Description */}
      {sanitizedHtml && (
        <div
          className="text-steam-text text-sm leading-relaxed prose prose-invert prose-sm max-w-none
            prose-p:my-2 prose-headings:text-steam-text prose-a:text-steam-blue prose-a:no-underline hover:prose-a:underline"
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
      )}
    </div>
  );
}
