/** Default SEO copy (aligned with in-app "Sobre" messaging). Keep in sync with public/index.html defaults. */
export const DEFAULT_PAGE_TITLE = 'CicloMapa';

export const DEFAULT_META_DESCRIPTION =
  'Mapa colaborativo gratuito da infraestrutura cicloviária no Brasil: ciclovias, ciclofaixas e ciclorrotas com dados do OpenStreetMap. Visualize, baixe dados e colabore.';

const MAX_DESCRIPTION_LENGTH = 160;

function truncateDescription(text) {
  if (text.length <= MAX_DESCRIPTION_LENGTH) return text;
  return `${text.slice(0, MAX_DESCRIPTION_LENGTH - 1).trim()}…`;
}

function primaryPlaceLabel(area) {
  if (!area || typeof area !== 'string') return '';
  return area.split(',')[0].trim();
}

/**
 * Updates document title and meta description when the map city (area) changes.
 * Open Graph / Twitter tags stay on the default homepage values from index.html.
 */
export function updateDocumentMeta(area) {
  const label = primaryPlaceLabel(area);

  document.title = label ? `${label} — ${DEFAULT_PAGE_TITLE}` : DEFAULT_PAGE_TITLE;

  const description = label
    ? truncateDescription(
        `Mapa cicloviário de ${label} no CicloMapa: ciclovias, ciclofaixas e ciclorrotas com dados do OpenStreetMap. Visualize e baixe dados gratuitamente.`
      )
    : DEFAULT_META_DESCRIPTION;

  const meta =
    document.querySelector('meta[name="description"]') ||
    document.querySelector('meta[name="Description"]');
  if (meta) {
    meta.setAttribute('content', description);
  }
}
