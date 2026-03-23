import { arrowIcons, arrowIconsByLayer, arrowSdf, iconsMap } from './icons';

describe('map icons', () => {
  it('maps each arrow layer id to an arrow sprite key', () => {
    expect(arrowIconsByLayer.Ciclovia).toBe('arrow-ciclovia');
    expect(arrowIconsByLayer.Ciclofaixa).toBe('arrow-ciclofaixa');
    expect(arrowIconsByLayer.Ciclorrota).toBe('arrow-ciclofaixa');
  });

  it('exposes image URLs for every arrowIconsByLayer target', () => {
    Object.values(arrowIconsByLayer).forEach((key) => {
      expect(arrowIcons[key]).toBeDefined();
      expect(typeof arrowIcons[key]).toBe('string');
    });
  });

  it('includes expected POI icon keys', () => {
    expect(iconsMap['poi-comment']).toBeDefined();
    expect(iconsMap['poi-bikeparking']).toBeDefined();
    expect(iconsMap['poi-bikeshop']).toBeDefined();
    expect(iconsMap['poi-rental']).toBeDefined();
  });

  it('exports arrowSdf as a string URL stub in tests', () => {
    expect(typeof arrowSdf).toBe('string');
  });
});
