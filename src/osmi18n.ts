/*
 * Brazilian Portuguese translations for common OSM tags,
 * used to detailed information in the popups.
 */
export const osmi18n: Record<string, string | null> = {
  /*
   * Cycleway tags
   */

  // Surface types
  surface: 'Superfície',
  asphalt: 'Asfalto',
  concrete: 'Concreto',
  gravel: 'Pedra',
  dirt: 'Solo',
  grass: 'Grama',
  sand: 'Areia',
  paving_stones: 'Caminho de pedra',
  paved: 'Pavimento',

  // Properties
  maxspeed: 'Velocidade máxima',
  oneway: 'Via de sentido único?',
  'oneway:bicycle': 'Sentido único para bicicletas?',

  // Road types
  path: 'Caminho',
  tertiary: 'Terciária',
  secondary: 'Secundária',
  primary: 'Primária',
  trunk: 'Rodovia',
  unclassified: 'Não classificada',
  living_street: 'Residencial',
  residential: 'Residencial',
  service: 'Serviço',
  tunnel: 'Túnel?',
  pedestrian: 'Passeio',
  lane: 'Faixa',
  buffered_lane: 'Faixa bufferizada',
  shared_lane: 'Faixa compartilhada',
  share_busway: 'Faixa compartilhada com ônibus',
  opposite_share_busway: 'Faixa oposta compartilhada com ônibus',
  sidepath: 'Caminho lateral',
  opposite_track: 'Caminho oposto',
  opposite_lane: 'Faixa oposta',
  opposite_buffered_lane: 'Faixa oposta bufferizada',
  opposite_shared_lane: 'Faixa oposta compartilhada',

  /*
   * POI tags
   */

  // Bike parking
  covered: 'Coberto?',
  access: 'Acesso',
  capacity: 'Capacidade',
  cyclestreets_id: '',
  maxstay: 'Estadia máxima',
  surveillance: 'Vigilado?',
  supervised: 'Supervisionado?',
  lit: 'Iluminado?',
  bicycle_parking: 'Tipo',

  // Bike parking types
  stands: 'U invertido',
  wall_loops: 'De roda',
  rack: 'Grelha',
  wave: 'Onda',
  ground_slots: 'Buracos no chão',
  wide_stands: 'U invertido grande',
  anchors: 'Âncora',
  shed: 'Abrigo',
  bollard: '',
  informal: 'Informal',
  streetpod: '',
  tree: 'Árvore',
  rope: 'Corda',
  'two-tier': '',
  floor: '',
  handlebar_holder: '',

  // Bike sharing & rental
  ref: 'Referência',
  network: 'Rede',
  description: 'Descrição',
  'payment:cash': 'Pagamento por dinheiro?',
  'payment:credit_cards': 'Pagamento por cartão de crédito?',
  'payment:debit_cards': 'Pagamento por cartão de débito?',
  'payment:bilhete_único': 'Pagamento por Bilhete Único?',
  'payment:mobile_app': 'Pagamento por App?',
  operator: 'Operador',
  'operator:type': 'Tipo de operador',

  // Bike sharing operator types
  government: 'Governamental',
  religious: 'Religioso',
  ngo: 'ONG',
  community: 'Comunitário',
  consortium: 'Consórcio',
  cooperative: 'Cooperativa',

  // Bike shops
  repair: 'Reparos',
  second_hand: 'Revenda',
  phone: 'Telefone',
  'phone:2': 'Telefone 2',
  'phone:3': 'Telefone 3',
  level: 'Andar',
  start_date: 'Desde',
  'service:bicycle:chaintool': 'Chave de corrente?',
  'service:bicycle:repair': 'Conserto?',
  'service:bicycle:rental': 'Aluguel?',
  'service:bicycle:pump': 'Bomba?',
  'service:bicycle:diy': 'DIY (faça-você-mesmo)?',
  'service:bicycle:cleaning': 'Limpeza?',
  'service:bicycle:second_hand': 'Revenda?',
  'service:bicycle:charging': 'Carregamento?',
  'service:bicycle:retail': 'Venda de bikes?',
  'service:bicycle:parts': 'Venda de peças?',
  'service:bicycle:tools': 'Ferramentas disponíveis',

  //////////////////////////

  // Generic
  website: 'Site',
  opening_hours: 'Horários',
  note: 'Comentário',
  'note:pt': 'Comentário',
  email: 'Email',
  wheelchair: 'Acessível por cadeira de rodas?',
  yes: 'Sim',
  no: 'Não',
  unknown: 'Desconhecido',
  free: 'Grátis?',
  fee: 'Pago?',
  only: 'Somente isso',
  tyres: 'Pneus',
  public: 'Público',
  private: 'Privado',
  limited: 'Limitado',
  designated: '',
  permissive: 'Permissivo?',
  customers: 'Clientes',
  'addr:street': 'Rua',
  'addr:housenumber': 'Número',

  // Custom internal tags (not from OSM!)
  'ciclomapa:address': 'Endereço',

  //////////////////////////

  /*
   * Ignored OSM tags
   */
  id: null,
  amenity: null,
  name: null,
  'name:pt': null,
  source: null,
  shop: null,
  alt_name: null,
  'addr:housename': null,
  'addr:door': null,
  'addr:postcode': null,
  'addr:unit': null,
  'addr:city': null,
  'addr:state': null,
  'addr:country': null,
  'addr:suburb': null,
  'addr:room': null,
  internet_access: null,
  'internet_access:key': null,
  'internet_access:ssid': null,
  'pt:bicycle_parking': null,
  'bicycle_parking:pt': null,
  'survey:date': null,
  'disused:amenity': null,
};

export type OsmDebugTagInfo = {
  summary: string;
  /** Common OSM values, shown as a list under the summary. */
  values?: string[];
};

/**
 * Raw OSM keys that feed CicloMapa typology filters (layers.v2.json).
 * Order = display priority in the debug tag grid.
 */
export const osmTypologyDebugKeyOrder: string[] = [
  'type',
  'highway',
  'cycleway',
  'cycleway:left',
  'cycleway:right',
  'cycleway:both',
  'segregated',
  'bicycle',
  'foot',
  'amenity',
  'shop',
];

/** Rank for sorting typology keys; -1 means "other" (collapsed under Ver mais). */
export function osmTypologyDebugRank(key: string): number {
  const exact = osmTypologyDebugKeyOrder.indexOf(key);
  if (exact >= 0) return exact;
  // Same family as cycleway=*, keep with the typology group.
  if (key.startsWith('cycleway:')) {
    return osmTypologyDebugKeyOrder.indexOf('cycleway') + 0.5;
  }
  return -1;
}

/*
 * Descriptions for raw OSM keys shown in the debug tag grid.
 * Based on https://wiki.openstreetmap.org/ — values kept in English as in OSM.
 */
export const osmDebugTagDescriptions: Record<string, OsmDebugTagInfo> = {
  id: {
    summary:
      'Identificador OSM do elemento (ex.: way/311571202 ou node/123). Não é uma tag do mapa; vem do próprio objeto.',
  },
  '@id': {
    summary: 'Identificador OSM do elemento (ex.: way/311571202). Mesma ideia da propriedade id.',
  },

  highway: {
    summary:
      'Classificação principal da via. Em vias de carro, cycleway=* na própria rua costuma ser preferível a desenhar outra way.',
    values: [
      'cycleway — via só de bike',
      'path — caminho genérico',
      'footway — calçada/passagem a pé',
      'pedestrian — área pedonal',
      'track — estrada de serviço/rural',
      'living_street — rua compartilhada de baixa velocidade',
    ],
  },

  bicycle: {
    summary: 'Acesso/uso por bicicleta.',
    values: [
      'designated — sinalizado/oficial para bikes',
      'yes — permitido',
      'no — proibido',
      'dismount — desmonte e empurre',
      'permissive',
      'private',
      'customers',
    ],
  },

  foot: {
    summary: 'Acesso a pé. Em highway=cycleway, foot=* deixa explícito se pedestres podem usar.',
    values: [
      'designated — oficial para pedestres',
      'yes — permitido',
      'no — proibido',
      'permissive',
      'private',
      'customers',
    ],
  },

  segregated: {
    summary:
      'Em caminho compartilhado bike+pé. Sem valor padrão; útil com highway=cycleway/footway/path + bicycle/foot=designated.',
    values: ['yes — faixas separadas', 'no — mesmo espaço compartilhado'],
  },

  cycleway: {
    summary:
      'Infra de bike marcada na própria via (não como way separada). Também cycleway:left/right/both=*.',
    values: [
      'track — pista segregada',
      'lane — faixa pintada',
      'buffered_lane — faixa com buffer',
      'shared_lane — compartilhamento sinalizado',
      'share_busway — compartilhada com ônibus',
      'opposite_track / opposite_lane — contrafluxo',
      'sidepath — caminho lateral',
      'no — sem infra',
    ],
  },

  'cycleway:left': {
    summary: 'Infra de bike só no lado esquerdo da via. Mesmos valores de cycleway=*.',
    values: ['track', 'lane', 'buffered_lane', 'shared_lane', 'share_busway', 'no'],
  },
  'cycleway:right': {
    summary: 'Infra de bike só no lado direito da via. Mesmos valores de cycleway=*.',
    values: ['track', 'lane', 'buffered_lane', 'shared_lane', 'share_busway', 'no'],
  },
  'cycleway:both': {
    summary: 'Infra de bike nos dois lados da via. Mesmos valores de cycleway=*.',
    values: ['track', 'lane', 'buffered_lane', 'shared_lane', 'share_busway', 'no'],
  },

  name: {
    summary: 'Nome principal do elemento no OSM. Pode aparecer em vários idiomas via name:xx.',
  },
  'name:pt': {
    summary: 'Nome em português (quando difere do name genérico).',
  },
  alt_name: {
    summary: 'Nome alternativo ou popular, além do name oficial.',
  },

  amenity: {
    summary: 'Tipo de equipamento/serviço.',
    values: ['bicycle_parking — paraciclo/bicicletário', 'bicycle_rental — aluguel/compartilhada'],
  },
  shop: {
    summary: 'Tipo de loja. Em CicloMapa o foco é oficina/loja de bikes.',
    values: ['bicycle — oficina/loja de bikes'],
  },

  source: {
    summary: 'Origem da informação do mapa (texto livre).',
    values: [
      'survey — vistoria no local',
      'imagery — imagem aérea/satélite',
      'gps',
      'knowledge — conhecimento local',
      '(ou o nome de uma base/projeto)',
    ],
  },
  'source:*': {
    summary:
      'Origem de uma tag específica (ex.: source:lit, source:surface). Mesma ideia de source=*.',
    values: ['survey', 'imagery', 'gps', 'knowledge'],
  },
  'survey:date': {
    summary: 'Data da vistoria no local que originou ou confirmou as tags (geralmente AAAA-MM-DD).',
  },

  type: {
    summary:
      'Tipologia atribuída pelo CicloMapa (Ciclovia, Ciclofaixa, etc.), não é tag OSM original.',
  },

  bridge: {
    summary: 'Se o trecho é uma ponte.',
    values: ['yes', 'boardwalk', 'aqueduct'],
  },
  tunnel: {
    summary: 'Se o trecho passa em túnel.',
    values: ['yes', 'building_passage', 'culvert'],
  },
  width: {
    summary: 'Largura da via, em metros (número, ex.: 2.5).',
  },
  incline: {
    summary: 'Inclinação da via.',
    values: ['up', 'down', '10% / -5% — porcentagem'],
  },
  smoothness: {
    summary: 'Quão regular é a superfície para rodas.',
    values: [
      'excellent',
      'good',
      'intermediate',
      'bad',
      'very_bad',
      'horrible',
      'very_horrible',
      'impassable',
    ],
  },
  tracktype: {
    summary: 'Qualidade/firmeza de estradas de terra (highway=track).',
    values: ['grade1 — mais firme', 'grade2', 'grade3', 'grade4', 'grade5 — mais frouxa'],
  },
  sidewalk: {
    summary: 'Calçada ligada à via. Em cycleways, sidewalk=* implica pedestres segregados.',
    values: ['both', 'left', 'right', 'no', 'separate'],
  },
  crossing: {
    summary: 'Tipo de travessia.',
    values: ['traffic_signals', 'marked', 'unmarked', 'uncontrolled', 'zebra', 'island'],
  },
  layer: {
    summary: 'Ordem vertical quando vias se cruzam (ponte/túnel). Inteiro relativo; 0 é o padrão.',
    values: ['1 — acima', '0 — padrão', '-1 — abaixo'],
  },
  area: {
    summary: 'Se o elemento é uma área (polígono) e não só uma linha.',
    values: ['yes', 'no'],
  },

  motor_vehicle: {
    summary: 'Acesso a veículos motorizados.',
    values: ['yes', 'no', 'private', 'destination', 'agricultural', 'forestry'],
  },
  horse: {
    summary: 'Acesso a cavalo.',
    values: ['yes', 'no', 'designated', 'permissive', 'private'],
  },
  moped: {
    summary: 'Acesso a ciclomotor.',
    values: ['yes', 'no', 'designated'],
  },

  internet_access: {
    summary: 'Se há internet no local.',
    values: ['yes', 'no', 'wlan', 'terminal', 'wired'],
  },
  'internet_access:ssid': {
    summary: 'Nome da rede Wi-Fi (SSID), quando internet_access=wlan.',
  },
  'disused:amenity': {
    summary: 'Amenity que existia e está desativada; o valor é o tipo antigo.',
    values: ['bicycle_parking', '(outros amenity=*)'],
  },
};

/** Tooltip info for a raw OSM/debug tag key. */
export function getOsmDebugTagDescription(key: string): OsmDebugTagInfo | undefined {
  if (osmDebugTagDescriptions[key]) {
    return osmDebugTagDescriptions[key];
  }
  if (key.startsWith('source:')) {
    return osmDebugTagDescriptions['source:*'];
  }
  if (key.startsWith('ciclomapa:')) {
    return {
      summary: 'Tag interna do CicloMapa (processamento/dedupe), não vem do OpenStreetMap.',
    };
  }
  if (key.startsWith('cycleway:')) {
    return osmDebugTagDescriptions.cycleway;
  }
  return undefined;
}
