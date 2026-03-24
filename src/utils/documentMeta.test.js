import { updateDocumentMeta, DEFAULT_PAGE_TITLE, DEFAULT_META_DESCRIPTION } from './documentMeta.js';

describe('updateDocumentMeta', () => {
  beforeEach(() => {
    document.head.innerHTML = '<meta name="description" content="">';
    document.title = '';
  });

  it('sets default title and description when area is empty', () => {
    updateDocumentMeta('');
    expect(document.title).toBe(DEFAULT_PAGE_TITLE);
    expect(document.querySelector('meta[name="description"]').getAttribute('content')).toBe(
      DEFAULT_META_DESCRIPTION
    );
  });

  it('uses first segment of area for title and city-specific description', () => {
    updateDocumentMeta('São Paulo, SP, Brasil');
    expect(document.title).toBe(`São Paulo — ${DEFAULT_PAGE_TITLE}`);
    const desc = document.querySelector('meta[name="description"]').getAttribute('content');
    expect(desc).toContain('São Paulo');
    expect(desc.length).toBeLessThanOrEqual(160);
  });
});
