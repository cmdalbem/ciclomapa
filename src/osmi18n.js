/*
 * Brazilian Portuguese translations for common OSM tags,
 * used to detailed information in the popups.
 */
export const osmi18n = {    
    /*
     * Cycleway tags
     */
    lit: 'Iluminado',
    
    // Surface types
    surface: 'Superfície',
    asphalt: 'Asfalto',
    concrete: 'Concreto',
    gravel: 'Pedra',
    dirt: 'Solo',
    grass: 'Grama',
    sand: 'Areia',
    paving_stones: "Caminho de pedra",
    paved: 'Pavimento',

    // Properties
    maxspeed: 'Velocidade máxima',
    oneway: 'Sentido único?',
    "oneway:bicycle": 'Sentido único para bicicletas?',
    
    // Road types
    // highway: 'Estrada',
    // track: 'Estrada',
    path: 'Caminho',
    // cycleway: 'Caminho para bicicletas',
    // footway: 'Caminho para pedestres',
    // sidewalk: 'Caminho para pedestres',
    "cycleway:left": 'Tipo de caminho para bicicletas na esquerda',
    "cycleway:right": 'Tipo de caminho para bicicletas na direita',
    "cycleway:both": 'Tipo de caminho para bicicletas em ambos lados',
    "cycleway:opposite": 'Tipo de caminho para bicicletas (lado oposto)',
    "cycleway:opposite:left": 'Tipo de caminho para bicicletas (lado oposto esquerdo)',
    "cycleway:opposite:right": 'Tipo de caminho para bicicletas (lado oposto direito)',
    "cycleway:opposite:both": 'Tipo de caminho para bicicletas (lado oposto, ambos lados)',
    tertiary: 'Terciária',
    secondary: 'Secundária',
    primary: 'Primária',
    // motorway: 'Estrada',
    trunk: 'Rodovia',
    unclassified: 'Não classificada',
    living_street: 'Residencial',
    residential: 'Residencial',
    service: 'Serviço',
    tunnel: 'Túnel?',
    pedestrian: 'Passeio',
    // bicycle: 'Bicicleta',
    // foot: 'Passeio',
    lane: 'Faixa',
    // lanes: 'Nro de faixas',
    buffered_lane: 'Faixa bufferizada',
    shared_lane: 'Faixa compartilhada',
    share_busway: 'Faixa compartilhada com ônibus',
    opposite_share_busway: 'Faixa oposta compartilhada com ônibus',
    sidepath: 'Caminho lateral',
    opposite_track: 'Caminho oposto',
    opposite_lane: 'Faixa oposta',
    opposite_buffered_lane: 'Faixa oposta bufferizada',
    opposite_shared_lane: 'Faixa oposta compartilhada',
    opposite_share_busway: 'Faixa oposta compartilhada com ônibus',



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
    lockers: 'Armários',
    // building: 'Prédio',
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
    public: 'Público?',
    private: 'Privado?',
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
    'id':  null,
    'amenity':  null,
    'name': null,
    'name:pt': null,
    'source': null,
    'shop': null,
    'alt_name': null,
    'addr:housename': null,
    'addr:door': null,
    'addr:postcode': null,
    'addr:unit': null,
    'addr:city': null,
    'addr:state': null,
    'addr:country': null,
    'addr:suburb': null,
    'addr:room': null,
    'internet_access': null,
    'internet_access:key': null,
    'internet_access:ssid': null,
    'pt:bicycle_parking': null,
    'bicycle_parking:pt': null,
    'survey:date': null,
    'disused:amenity': null,
}