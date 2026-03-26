const PREDEFINED_CITY_CATALOG = {
  // Brazil
  'sao-paulo': {
    query: 'Sao Paulo',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'São Paulo, São Paulo, Brasil',
      lat: -23.5506507,
      lng: -46.6333824,
    },
  },
  'rio-de-janeiro': {
    query: 'Rio de Janeiro',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Rio de Janeiro, Rio de Janeiro, Brasil',
      lat: -22.9110137,
      lng: -43.2093727,
    },
  },
  'belo-horizonte': {
    query: 'Belo Horizonte',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Belo Horizonte, Minas Gerais, Brasil',
      lat: -19.9227318,
      lng: -43.9450948,
    },
  },
  brasilia: {
    query: 'Brasilia',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Brasília, Distrito Federal, Brasil',
      lat: -15.7939869,
      lng: -47.8828,
    },
  },
  salvador: {
    query: 'Salvador',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Salvador, Bahia, Brasil',
      lat: -12.9822499,
      lng: -38.4812772,
    },
  },
  fortaleza: {
    query: 'Fortaleza',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Fortaleza, Ceará, Brasil',
      lat: -3.7304512,
      lng: -38.5217989,
    },
  },
  recife: {
    query: 'Recife',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Recife, Pernambuco, Brasil',
      lat: -8.0584933,
      lng: -34.8848193,
    },
  },
  'porto-alegre': {
    query: 'Porto Alegre',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Porto Alegre, Rio Grande do Sul, Brasil',
      lat: -30.0324999,
      lng: -51.2303767,
    },
  },
  curitiba: {
    query: 'Curitiba',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Curitiba, Paraná, Brasil',
      lat: -25.4295963,
      lng: -49.2712724,
    },
  },
  manaus: {
    query: 'Manaus',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Manaus, Amazonas, Brasil',
      lat: -3.1316333,
      lng: -59.9825041,
    },
  },
  belem: {
    query: 'Belem',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Belém, Pará, Brasil',
      lat: -1.45056,
      lng: -48.4682453,
    },
  },
  goiania: {
    query: 'Goiania',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Goiânia, Goiás, Brasil',
      lat: -16.680882,
      lng: -49.2532691,
    },
  },
  guarulhos: {
    query: 'Guarulhos',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Guarulhos, São Paulo, Brasil',
      lat: -23.4675941,
      lng: -46.5277704,
    },
  },
  campinas: {
    query: 'Campinas',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Campinas, São Paulo, Brasil',
      lat: -22.9056391,
      lng: -47.059564,
    },
  },
  'sao-luis': {
    query: 'Sao Luis',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'São Luís, Maranhão, Brasil',
      lat: -2.5295265,
      lng: -44.2963942,
    },
  },
  'sao-goncalo': {
    query: 'Sao Goncalo',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'São Gonçalo, Rio de Janeiro, Brasil',
      lat: -22.821635,
      lng: -42.9956797,
    },
  },
  maceio: {
    query: 'Maceio',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Maceió, Alagoas, Brasil',
      lat: -9.6476843,
      lng: -35.7339264,
    },
  },
  'duque-de-caxias': {
    query: 'Duque de Caxias',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Duque de Caxias, Rio de Janeiro, Brasil',
      lat: -22.6429163,
      lng: -43.3021266,
    },
  },
  natal: {
    query: 'Natal',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Natal, Rio Grande do Norte, Brasil',
      lat: -5.805398,
      lng: -35.2080905,
    },
  },
  teresina: {
    query: 'Teresina',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Teresina, Piauí, Brasil',
      lat: -5.0874608,
      lng: -42.8049571,
    },
  },
  'sao-bernardo-do-campo': {
    query: 'Sao Bernardo do Campo',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'São Bernardo do Campo, São Paulo, Brasil',
      lat: -23.7080345,
      lng: -46.5506747,
    },
  },
  'nova-iguacu': {
    query: 'Nova Iguacu',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Nova Iguaçu, Rio de Janeiro, Brasil',
      lat: -22.7592175,
      lng: -43.4508728,
    },
  },
  'joao-pessoa': {
    query: 'Joao Pessoa',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'João Pessoa, Paraíba, Brasil',
      lat: -7.1215981,
      lng: -34.882028,
    },
  },
  'santo-andre': {
    query: 'Santo Andre',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Santo André, São Paulo, Brasil',
      lat: -23.6533509,
      lng: -46.5279039,
    },
  },
  osasco: {
    query: 'Osasco',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Osasco, São Paulo, Brasil',
      lat: -23.5324859,
      lng: -46.7916801,
    },
  },
  'sao-jose-dos-campos': {
    query: 'Sao Jose dos Campos',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'São José dos Campos, São Paulo, Brasil',
      lat: -23.1867782,
      lng: -45.8854538,
    },
  },
  'jaboatao-dos-guararapes': {
    query: 'Jaboatao dos Guararapes',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Jaboatão dos Guararapes, Pernambuco, Brasil',
      lat: -8.1752476,
      lng: -34.9468716,
    },
  },
  'ribeirao-preto': {
    query: 'Ribeirao Preto',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Ribeirão Preto, São Paulo, Brasil',
      lat: -21.1776315,
      lng: -47.8100983,
    },
  },
  uberlandia: {
    query: 'Uberlandia',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Uberlândia, Minas Gerais, Brasil',
      lat: -18.9188041,
      lng: -48.2767837,
    },
  },
  contagem: {
    query: 'Contagem',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Contagem, Minas Gerais, Brasil',
      lat: -19.9132749,
      lng: -44.0840953,
    },
  },
  aracaju: {
    query: 'Aracaju',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Aracaju, Sergipe, Brasil',
      lat: -10.9162061,
      lng: -37.0774655,
    },
  },
  'feira-de-santana': {
    query: 'Feira de Santana',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Feira de Santana, Bahia, Brasil',
      lat: -12.2578934,
      lng: -38.9598047,
    },
  },
  cuiaba: {
    query: 'Cuiaba',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Cuiabá, Mato Grosso, Brasil',
      lat: -15.5986686,
      lng: -56.0991301,
    },
  },
  sorocaba: {
    query: 'Sorocaba',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Sorocaba, São Paulo, Brasil',
      lat: -23.5003451,
      lng: -47.4582864,
    },
  },
  'juiz-de-fora': {
    query: 'Juiz de Fora',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Juiz de Fora, Minas Gerais, Brasil',
      lat: -21.7609533,
      lng: -43.3501129,
    },
  },
  londrina: {
    query: 'Londrina',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Londrina, Paraná, Brasil',
      lat: -23.3112878,
      lng: -51.1595023,
    },
  },
  joinville: {
    query: 'Joinville',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Joinville, Santa Catarina, Brasil',
      lat: -26.3044898,
      lng: -48.8486726,
    },
  },
  'aparecida-de-goiania': {
    query: 'Aparecida de Goiania',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Aparecida de Goiânia, Goiás, Brasil',
      lat: -16.8226769,
      lng: -49.2452546,
    },
  },
  ananindeua: {
    query: 'Ananindeua',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Ananindeua, Pará, Brasil',
      lat: -1.374035,
      lng: -48.4016623,
    },
  },
  niteroi: {
    query: 'Niteroi',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Niterói, Rio de Janeiro, Brasil',
      lat: -22.8884,
      lng: -43.1147,
    },
  },
  'belford-roxo': {
    query: 'Belford Roxo',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Belford Roxo, Rio de Janeiro, Brasil',
      lat: -22.7667284,
      lng: -43.4033603,
    },
  },
  'campos-dos-goytacazes': {
    query: 'Campos dos Goytacazes',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Campos dos Goytacazes, Rio de Janeiro, Brasil',
      lat: -21.7546,
      lng: -41.3242,
    },
  },
  serra: {
    query: 'Serra',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Serra, Região Geográfica Intermediária de Vitória, Brasil',
      lat: -20.1252961,
      lng: -40.3064477,
    },
  },
  florianopolis: {
    query: 'Florianopolis',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Florianópolis, Santa Catarina, Brasil',
      lat: -27.5973002,
      lng: -48.5496098,
    },
  },
  'vila-velha': {
    query: 'Vila Velha',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Vila Velha, Região Geográfica Intermediária de Vitória, Brasil',
      lat: -20.3297037,
      lng: -40.2920174,
    },
  },
  maua: {
    query: 'Maua',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Mauá, São Paulo, Brasil',
      lat: -23.6669527,
      lng: -46.4616922,
    },
  },
  'sao-joao-de-meriti': {
    query: 'Sao Joao de Meriti',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'São João de Meriti, Rio de Janeiro, Brasil',
      lat: -22.7853575,
      lng: -43.366715,
    },
  },
  carapicuiba: {
    query: 'Carapicuiba',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Carapicuíba, São Paulo, Brasil',
      lat: -23.5234673,
      lng: -46.8406808,
    },
  },
  olinda: {
    query: 'Olinda',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Olinda, Pernambuco, Brasil',
      lat: -7.9986401,
      lng: -34.8459552,
    },
  },
  'caxias-do-sul': {
    query: 'Caxias do Sul',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Caxias do Sul, Rio Grande do Sul, Brasil',
      lat: -29.1685045,
      lng: -51.1796385,
    },
  },
  'rio-branco': {
    query: 'Rio Branco',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Rio Branco, Acre, Brasil',
      lat: -9.9759918,
      lng: -67.8244857,
    },
  },
  macapa: {
    query: 'Macapa',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Macapá, Amapá, Brasil',
      lat: 0.0349338,
      lng: -51.0693948,
    },
  },
  'porto-velho': {
    query: 'Porto Velho',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Porto Velho, Rondônia, Brasil',
      lat: -8.7607721,
      lng: -63.8998835,
    },
  },
  'boa-vista': {
    query: 'Boa Vista',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Boa Vista, Roraima, Brasil',
      lat: 2.8235098,
      lng: -60.6758331,
    },
  },
  palmas: {
    query: 'Palmas',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Palmas, Tocantins, Brasil',
      lat: -10.184,
      lng: -48.3336,
    },
  },
  vitoria: {
    query: 'Vitoria, Espirito Santo',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Vitória, Espírito Santo, Brasil',
      lat: -20.3155,
      lng: -40.3128,
    },
  },
  'campo-grande': {
    query: 'Campo Grande',
    countrycodes: ['br'],
    staticLocation: {
      areaLabel: 'Campo Grande, Mato Grosso do Sul, Brasil',
      lat: -20.4697105,
      lng: -54.6201211,
    },
  },

  // Argentina
  'buenos-aires': {
    query: 'Buenos Aires',
    countrycodes: ['ar'],
    staticLocation: {
      areaLabel: 'Buenos Aires, Autonomous City of Buenos Aires, Argentina',
      lat: -34.6095579,
      lng: -58.3887904,
    },
  },
  cordoba: {
    query: 'Cordoba',
    countrycodes: ['ar'],
    staticLocation: {
      areaLabel: 'Córdova, Córdova, Argentina',
      lat: -31.4166867,
      lng: -64.1834193,
    },
  },
  rosario: {
    query: 'Rosario',
    countrycodes: ['ar'],
    staticLocation: {
      areaLabel: 'Rosário, Santa Fe, Argentina',
      lat: -32.9593609,
      lng: -60.6617024,
    },
  },
  mendoza: {
    query: 'Mendoza',
    countrycodes: ['ar'],
    staticLocation: {
      areaLabel: 'Mendoza, Mendoza, Argentina',
      lat: -32.8894155,
      lng: -68.8446177,
    },
  },

  // Colombia
  bogota: {
    query: 'Bogota',
    countrycodes: ['co'],
    staticLocation: {
      areaLabel: 'Bogotá, Bogota, Capital District, Colômbia',
      lat: 4.6533817,
      lng: -74.0836331,
    },
  },
  medellin: {
    query: 'Medellin',
    countrycodes: ['co'],
    staticLocation: {
      areaLabel: 'Medellín, Antioquia, Colômbia',
      lat: 6.2697325,
      lng: -75.6025597,
    },
  },
  cali: {
    query: 'Cali',
    countrycodes: ['co'],
    staticLocation: {
      areaLabel: 'Cáli, Valle del Cauca, Colômbia',
      lat: 3.4519988,
      lng: -76.5325259,
    },
  },
  barranquilla: {
    query: 'Barranquilla',
    countrycodes: ['co'],
    staticLocation: {
      areaLabel: 'Perímetro Urbano Barranquilla, Atlántico, Colômbia',
      lat: 10.9938599,
      lng: -74.7926118,
    },
  },
  cartagena: {
    query: 'Cartagena',
    countrycodes: ['co'],
    staticLocation: {
      areaLabel: 'Cartagena, Bolívar, Colômbia',
      lat: 10.4265566,
      lng: -75.5441671,
    },
  },

  // Peru
  lima: {
    query: 'Lima',
    countrycodes: ['pe'],
    staticLocation: {
      areaLabel: 'Lima, Lima, Peru',
      lat: -12.0459808,
      lng: -77.0305912,
    },
  },
  arequipa: {
    query: 'Arequipa',
    countrycodes: ['pe'],
    staticLocation: {
      areaLabel: 'Arequipa, Arequipa, Peru',
      lat: -16.3988667,
      lng: -71.5369607,
    },
  },
  trujillo: {
    query: 'Trujillo',
    countrycodes: ['pe'],
    staticLocation: {
      areaLabel: 'Trujillo, La Libertad, Peru',
      lat: -8.1116778,
      lng: -79.0287742,
    },
  },

  // Chile
  santiago: {
    query: 'Santiago',
    countrycodes: ['cl'],
    staticLocation: {
      areaLabel: 'Santiago, Região Metropolitana de Santiago, Chile',
      lat: -33.4376995,
      lng: -70.6510671,
    },
  },
  'santiago-do-chile': {
    query: 'Santiago',
    countrycodes: ['cl'],
    canonicalSlug: 'santiago',
    staticLocation: {
      areaLabel: 'Santiago, Região Metropolitana de Santiago, Chile',
      lat: -33.4376995,
      lng: -70.6510671,
    },
  },
  valparaiso: {
    query: 'Valparaiso',
    countrycodes: ['cl'],
    staticLocation: {
      areaLabel: 'Valparaíso, Região de Valparaiso, Chile',
      lat: -33.0458456,
      lng: -71.6196749,
    },
  },
  concepcion: {
    query: 'Concepcion',
    countrycodes: ['cl'],
    staticLocation: {
      areaLabel: 'Concepción, Região de Bío-Bío, Chile',
      lat: -36.8270698,
      lng: -73.0502064,
    },
  },

  // Uruguay
  montevideo: {
    query: 'Montevideo',
    countrycodes: ['uy'],
    staticLocation: {
      areaLabel: 'Montevidéu, Montevideo, Uruguai',
      lat: -34.9058916,
      lng: -56.1913095,
    },
  },

  // Ecuador
  quito: {
    query: 'Quito',
    countrycodes: ['ec'],
    staticLocation: {
      areaLabel: 'Quito, Equador',
      lat: -0.2201641,
      lng: -78.5123274,
    },
  },
  guayaquil: {
    query: 'Guayaquil',
    countrycodes: ['ec'],
    staticLocation: {
      areaLabel: 'Guaiaquil, Guayas, Equador',
      lat: -2.1900572,
      lng: -79.8868669,
    },
  },

  // Bolivia
  'la-paz': {
    query: 'La Paz',
    countrycodes: ['bo'],
    staticLocation: {
      areaLabel: 'La Paz, La Paz, Bolívia',
      lat: -16.4955455,
      lng: -68.1336229,
    },
  },
  'santa-cruz-de-la-sierra': {
    query: 'Santa Cruz de la Sierra',
    countrycodes: ['bo'],
    staticLocation: {
      areaLabel: 'Santa Cruz de la Sierra, Santa Cruz, Bolívia',
      lat: -17.7834217,
      lng: -63.1820853,
    },
  },

  // Paraguay
  assuncao: {
    query: 'Asuncion',
    countrycodes: ['py'],
    staticLocation: {
      areaLabel: 'Assunção, Paraguai',
      lat: -25.2800459,
      lng: -57.6343814,
    },
  },

  // Venezuela
  caracas: {
    query: 'Caracas',
    countrycodes: ['ve'],
    staticLocation: {
      areaLabel: 'Caracas, Capital District, Venezuela',
      lat: 10.5060934,
      lng: -66.9146008,
    },
  },

  // Portugal
  lisboa: {
    query: 'Lisboa',
    countrycodes: ['pt'],
    staticLocation: {
      areaLabel: 'Lisboa, Portugal',
      lat: 38.7077507,
      lng: -9.1365919,
    },
  },
  porto: {
    query: 'Porto',
    countrycodes: ['pt'],
    staticLocation: {
      areaLabel: 'Porto, Portugal',
      lat: 41.1502195,
      lng: -8.6103497,
    },
  },
  braga: {
    query: 'Braga',
    countrycodes: ['pt'],
    staticLocation: {
      areaLabel: 'Braga, Portugal',
      lat: 41.5510583,
      lng: -8.4280045,
    },
  },
  coimbra: {
    query: 'Coimbra',
    countrycodes: ['pt'],
    staticLocation: {
      areaLabel: 'Coimbra, Portugal',
      lat: 40.2111931,
      lng: -8.4294632,
    },
  },
  funchal: {
    query: 'Funchal',
    countrycodes: ['pt'],
    staticLocation: {
      areaLabel: 'Funchal, Portugal',
      lat: 32.6496497,
      lng: -16.9086783,
    },
  },

  // Spain
  madrid: {
    query: 'Madrid',
    countrycodes: ['es'],
    staticLocation: {
      areaLabel: 'Madrid, Comunidade de Madrid, Espanha',
      lat: 40.416782,
      lng: -3.703507,
    },
  },
  barcelona: {
    query: 'Barcelona',
    countrycodes: ['es'],
    staticLocation: {
      areaLabel: 'Barcelona, Catalunha, Espanha',
      lat: 41.3825802,
      lng: 2.177073,
    },
  },
  valencia: {
    query: 'Valencia',
    countrycodes: ['es'],
    staticLocation: {
      areaLabel: 'Valência, Comunidade Valenciana, Espanha',
      lat: 39.4697065,
      lng: -0.3763353,
    },
  },
  sevilla: {
    query: 'Sevilla',
    countrycodes: ['es'],
    staticLocation: {
      areaLabel: 'Sevilha, Andaluzia, Espanha',
      lat: 37.3886303,
      lng: -5.9953403,
    },
  },
  malaga: {
    query: 'Malaga',
    countrycodes: ['es'],
    staticLocation: {
      areaLabel: 'Málaga, Andaluzia, Espanha',
      lat: 36.7213028,
      lng: -4.4216366,
    },
  },
  bilbao: {
    query: 'Bilbao',
    countrycodes: ['es'],
    staticLocation: {
      areaLabel: 'Bilbau, Comunidade Autônoma do País Basco, Espanha',
      lat: 43.2630018,
      lng: -2.9350039,
    },
  },
  zaragoza: {
    query: 'Zaragoza',
    countrycodes: ['es'],
    staticLocation: {
      areaLabel: 'Zaragoza, Aragão, Espanha',
      lat: 41.6521342,
      lng: -0.8809428,
    },
  },
  murcia: {
    query: 'Murcia',
    countrycodes: ['es'],
    staticLocation: {
      areaLabel: 'Múrcia, Região de Múrcia, Espanha',
      lat: 37.9923795,
      lng: -1.1305431,
    },
  },
  'palma-de-mallorca': {
    query: 'Palma de Mallorca',
    countrycodes: ['es'],
    staticLocation: {
      areaLabel: 'Palma, Ilhas Baleares, Espanha',
      lat: 39.5695818,
      lng: 2.6500745,
    },
  },
  'las-palmas-de-gran-canaria': {
    query: 'Las Palmas de Gran Canaria',
    countrycodes: ['es'],
    staticLocation: {
      areaLabel: 'Las Palmas, Ilhas Canárias, Espanha',
      lat: 28.1288694,
      lng: -15.4349015,
    },
  },
};

export function getPredefinedCitySlugDefinition(slug) {
  if (!slug) return null;
  return PREDEFINED_CITY_CATALOG[String(slug).toLowerCase()] || null;
}

export function getCanonicalCitySlug(slug) {
  if (!slug) return null;
  const normalized = String(slug).toLowerCase();
  const definition = PREDEFINED_CITY_CATALOG[normalized];
  if (!definition) return normalized;
  return definition.canonicalSlug || normalized;
}

export function getSeoCitySlugs() {
  return Object.entries(PREDEFINED_CITY_CATALOG)
    .filter(([, value]) => !value.canonicalSlug)
    .map(([slug]) => slug);
}

export function getPredefinedCityStaticLocation(slug) {
  if (!slug) return null;
  const normalizedSlug = String(slug).toLowerCase();
  const definition = PREDEFINED_CITY_CATALOG[normalizedSlug];
  const location = definition?.staticLocation;
  if (!location) return null;

  const lat = Number(location.lat);
  const lng = Number(location.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    areaLabel: location.areaLabel || null,
    lat,
    lng,
  };
}
