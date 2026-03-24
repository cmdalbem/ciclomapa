const PREDEFINED_CITY_SLUGS = {
  // Brazil
  'sao-paulo': { query: 'Sao Paulo', countrycodes: ['br'] },
  'rio-de-janeiro': { query: 'Rio de Janeiro', countrycodes: ['br'] },
  'belo-horizonte': { query: 'Belo Horizonte', countrycodes: ['br'] },
  brasilia: { query: 'Brasilia', countrycodes: ['br'] },
  salvador: { query: 'Salvador', countrycodes: ['br'] },
  fortaleza: { query: 'Fortaleza', countrycodes: ['br'] },
  recife: { query: 'Recife', countrycodes: ['br'] },
  'porto-alegre': { query: 'Porto Alegre', countrycodes: ['br'] },
  curitiba: { query: 'Curitiba', countrycodes: ['br'] },
  manaus: { query: 'Manaus', countrycodes: ['br'] },
  belem: { query: 'Belem', countrycodes: ['br'] },
  goiania: { query: 'Goiania', countrycodes: ['br'] },
  guarulhos: { query: 'Guarulhos', countrycodes: ['br'] },
  campinas: { query: 'Campinas', countrycodes: ['br'] },
  'sao-luis': { query: 'Sao Luis', countrycodes: ['br'] },
  'sao-goncalo': { query: 'Sao Goncalo', countrycodes: ['br'] },
  maceio: { query: 'Maceio', countrycodes: ['br'] },
  'duque-de-caxias': { query: 'Duque de Caxias', countrycodes: ['br'] },
  natal: { query: 'Natal', countrycodes: ['br'] },
  teresina: { query: 'Teresina', countrycodes: ['br'] },
  'sao-bernardo-do-campo': { query: 'Sao Bernardo do Campo', countrycodes: ['br'] },
  'nova-iguacu': { query: 'Nova Iguacu', countrycodes: ['br'] },
  'joao-pessoa': { query: 'Joao Pessoa', countrycodes: ['br'] },
  'santo-andre': { query: 'Santo Andre', countrycodes: ['br'] },
  osasco: { query: 'Osasco', countrycodes: ['br'] },
  'sao-jose-dos-campos': { query: 'Sao Jose dos Campos', countrycodes: ['br'] },
  'jaboatao-dos-guararapes': { query: 'Jaboatao dos Guararapes', countrycodes: ['br'] },
  'ribeirao-preto': { query: 'Ribeirao Preto', countrycodes: ['br'] },
  uberlandia: { query: 'Uberlandia', countrycodes: ['br'] },
  contagem: { query: 'Contagem', countrycodes: ['br'] },
  aracaju: { query: 'Aracaju', countrycodes: ['br'] },
  'feira-de-santana': { query: 'Feira de Santana', countrycodes: ['br'] },
  cuiaba: { query: 'Cuiaba', countrycodes: ['br'] },
  sorocaba: { query: 'Sorocaba', countrycodes: ['br'] },
  'juiz-de-fora': { query: 'Juiz de Fora', countrycodes: ['br'] },
  londrina: { query: 'Londrina', countrycodes: ['br'] },
  joinville: { query: 'Joinville', countrycodes: ['br'] },
  'aparecida-de-goiania': { query: 'Aparecida de Goiania', countrycodes: ['br'] },
  ananindeua: { query: 'Ananindeua', countrycodes: ['br'] },
  niteroi: { query: 'Niteroi', countrycodes: ['br'] },
  'belford-roxo': { query: 'Belford Roxo', countrycodes: ['br'] },
  'campos-dos-goytacazes': { query: 'Campos dos Goytacazes', countrycodes: ['br'] },
  serra: { query: 'Serra', countrycodes: ['br'] },
  florianopolis: { query: 'Florianopolis', countrycodes: ['br'] },
  'vila-velha': { query: 'Vila Velha', countrycodes: ['br'] },
  maua: { query: 'Maua', countrycodes: ['br'] },
  'sao-joao-de-meriti': { query: 'Sao Joao de Meriti', countrycodes: ['br'] },
  carapicuiba: { query: 'Carapicuiba', countrycodes: ['br'] },
  olinda: { query: 'Olinda', countrycodes: ['br'] },
  'caxias-do-sul': { query: 'Caxias do Sul', countrycodes: ['br'] },

  // Mexico
  'cidade-do-mexico': {
    query: 'Ciudad de Mexico',
    countrycodes: ['mx'],
    canonicalSlug: 'ciudad-de-mexico',
  },
  'ciudad-de-mexico': { query: 'Ciudad de Mexico', countrycodes: ['mx'] },
  'mexico-city': { query: 'Ciudad de Mexico', countrycodes: ['mx'], canonicalSlug: 'ciudad-de-mexico' },
  guadalajara: { query: 'Guadalajara', countrycodes: ['mx'] },
  monterrey: { query: 'Monterrey', countrycodes: ['mx'] },
  puebla: { query: 'Puebla', countrycodes: ['mx'] },
  tijuana: { query: 'Tijuana', countrycodes: ['mx'] },
  leon: { query: 'Leon', countrycodes: ['mx'] },

  // Argentina
  'buenos-aires': { query: 'Buenos Aires', countrycodes: ['ar'] },
  cordoba: { query: 'Cordoba', countrycodes: ['ar'] },
  rosario: { query: 'Rosario', countrycodes: ['ar'] },
  mendoza: { query: 'Mendoza', countrycodes: ['ar'] },

  // Colombia
  bogota: { query: 'Bogota', countrycodes: ['co'] },
  medellin: { query: 'Medellin', countrycodes: ['co'] },
  cali: { query: 'Cali', countrycodes: ['co'] },
  barranquilla: { query: 'Barranquilla', countrycodes: ['co'] },
  cartagena: { query: 'Cartagena', countrycodes: ['co'] },

  // Peru
  lima: { query: 'Lima', countrycodes: ['pe'] },
  arequipa: { query: 'Arequipa', countrycodes: ['pe'] },
  trujillo: { query: 'Trujillo', countrycodes: ['pe'] },

  // Chile
  santiago: { query: 'Santiago', countrycodes: ['cl'] },
  'santiago-do-chile': { query: 'Santiago', countrycodes: ['cl'], canonicalSlug: 'santiago' },
  valparaiso: { query: 'Valparaiso', countrycodes: ['cl'] },
  concepcion: { query: 'Concepcion', countrycodes: ['cl'] },

  // Uruguay, Ecuador, Bolivia, Paraguay, Venezuela
  montevideo: { query: 'Montevideo', countrycodes: ['uy'] },
  quito: { query: 'Quito', countrycodes: ['ec'] },
  guayaquil: { query: 'Guayaquil', countrycodes: ['ec'] },
  'la-paz': { query: 'La Paz', countrycodes: ['bo'] },
  'santa-cruz-de-la-sierra': { query: 'Santa Cruz de la Sierra', countrycodes: ['bo'] },
  assuncao: { query: 'Asuncion', countrycodes: ['py'] },
  caracas: { query: 'Caracas', countrycodes: ['ve'] },

  // Portugal
  lisboa: { query: 'Lisboa', countrycodes: ['pt'] },
  porto: { query: 'Porto', countrycodes: ['pt'] },
  braga: { query: 'Braga', countrycodes: ['pt'] },
  coimbra: { query: 'Coimbra', countrycodes: ['pt'] },
  funchal: { query: 'Funchal', countrycodes: ['pt'] },

  // Spain
  madrid: { query: 'Madrid', countrycodes: ['es'] },
  barcelona: { query: 'Barcelona', countrycodes: ['es'] },
  valencia: { query: 'Valencia', countrycodes: ['es'] },
  sevilla: { query: 'Sevilla', countrycodes: ['es'] },
  malaga: { query: 'Malaga', countrycodes: ['es'] },
  bilbao: { query: 'Bilbao', countrycodes: ['es'] },
  zaragoza: { query: 'Zaragoza', countrycodes: ['es'] },
  murcia: { query: 'Murcia', countrycodes: ['es'] },
  'palma-de-mallorca': { query: 'Palma de Mallorca', countrycodes: ['es'] },
  'las-palmas-de-gran-canaria': { query: 'Las Palmas de Gran Canaria', countrycodes: ['es'] },
};

export function getPredefinedCitySlugDefinition(slug) {
  if (!slug) return null;
  return PREDEFINED_CITY_SLUGS[String(slug).toLowerCase()] || null;
}

export function getCanonicalCitySlug(slug) {
  if (!slug) return null;
  const normalized = String(slug).toLowerCase();
  const definition = PREDEFINED_CITY_SLUGS[normalized];
  if (!definition) return normalized;
  return definition.canonicalSlug || normalized;
}

export function getSeoCitySlugs() {
  return Object.entries(PREDEFINED_CITY_SLUGS)
    .filter(([, value]) => !value.canonicalSlug)
    .map(([slug]) => slug);
}

