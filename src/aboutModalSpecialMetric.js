/**
 * PNB is preferred when present (same priority as AnalyticsSidebar ordering).
 * @param {Record<string, unknown>|null|undefined} fields Airtable Metadata row fields
 * @returns {{ key: string; title: string; valueText: string; year?: unknown; href: string; blurb: string } | null}
 */
export function getAboutModalSpecialMetric(fields) {
  if (!fields || typeof fields !== 'object') return null;

  const pnb = fields.pnb_total;
  if (pnb !== undefined && pnb !== null && pnb !== '') {
    const n = Number(pnb);
    const valueText = Number.isFinite(n)
      ? `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
      : `${pnb}%`;
    return {
      key: 'pnb',
      title: 'PNB',
      valueText,
      year: fields.pnb_year,
      href: 'https://itdpbrasil.org/pnb/',
      blurb: 'Pessoas a até 300 m de ciclovias e ciclofaixas (ITDP Brasil).',
    };
  }

  const ide = fields.ideciclo;
  if (ide !== undefined && ide !== null && ide !== '') {
    const n = Number(ide);
    const valueText = Number.isFinite(n)
      ? n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : String(ide);
    return {
      key: 'ideciclo',
      title: 'IDECiclo',
      valueText,
      year: fields.ideciclo_year,
      href: 'https://www.ideciclo.org/',
      blurb: 'Índice de desenvolvimento cicloviário (escala 0 a 1).',
    };
  }

  return null;
}
