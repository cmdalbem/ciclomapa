# CicloMapa — Play Store Listing & Data Safety (PT-BR)

Ready-to-paste content for the Google Play Console store listing and the Data Safety form.
Copy is **PT-BR only** (primary market: Brasil/América Latina). Review before submitting — some
fields depend on choices outside the repo (analytics config, signing).

---

## 1. Store listing copy

### App name (máx. 30 caracteres)

```
CicloMapa
```

### Descrição curta / short description (máx. 80 caracteres)

```
Mapa de ciclovias e rotas seguras de bike, com dados abertos do OpenStreetMap.
```

> 78/80 caracteres. Alternativa mais curta:
>
> ```
> O mapa do ciclista urbano: ciclovias, rotas seguras e pontos de apoio.
> ```

### Descrição completa / full description (máx. 4000 caracteres)

```
O CicloMapa é o mapa do ciclista urbano. Encontre ciclovias, ciclofaixas e rotas
mais seguras para pedalar no seu dia a dia, além de bicicletários, paraciclos,
oficinas e estações de bicicleta compartilhada perto de você.

Construído sobre dados abertos do OpenStreetMap, o CicloMapa mostra a
infraestrutura cicloviária das cidades de forma clara e atualizada, ajudando
quem pedala a se deslocar com mais segurança e confiança.

PRINCIPAIS RECURSOS

• Mapa de infraestrutura cicloviária: veja ciclovias, ciclofaixas, ciclorrotas,
  calçadas compartilhadas e trilhas, cada tipo com sua cor e nível de proteção.
• Planejamento de rotas: trace trajetos de bicicleta e compare alternativas,
  com análise de quanto do caminho passa por infraestrutura cicloviária.
• Pontos de apoio: localize bicicletários, paraciclos, oficinas e estações de
  bicicleta compartilhada.
• Localização no mapa: veja onde você está para se orientar com facilidade
  (a permissão de localização é controlada pelo seu aparelho).
• Modo claro e escuro: leitura confortável de dia e à noite.
• Colaborativo: envie comentários e sugestões para melhorar os dados do mapa
  e ajudar a comunidade do OpenStreetMap.
• Cobertura ampla: dezenas de cidades no Brasil e na América Latina, além de
  Portugal e Espanha.

PARA QUEM É O CICLOMAPA

Para ciclistas e pessoas que se deslocam de bicicleta, cidadãos interessados na
mobilidade urbana, pesquisadores, universidades, organizações da sociedade civil
e gestores públicos que trabalham com transporte ativo.

DADOS ABERTOS E COLABORAÇÃO

As informações cicloviárias vêm do OpenStreetMap, um projeto colaborativo e de
dados abertos. Isso significa que o mapa é construído pela comunidade e pode ser
melhorado por qualquer pessoa — inclusive por você.

SOBRE O PROJETO

O CicloMapa é uma iniciativa sem fins lucrativos mantida em parceria pela UCB —
União de Ciclistas do Brasil e pelo ITDP — Instituto de Políticas de Transporte e
Desenvolvimento. É gratuito, não exige cadastro e respeita a sua privacidade.

Aviso de privacidade: https://ciclomapa.app/privacidade
Acesse também pela web: https://ciclomapa.app
```

### Notas da versão / release notes (primeira versão, máx. 500 caracteres)

```
Primeira versão do CicloMapa na Play Store!

• Mapa de ciclovias, ciclofaixas e pontos de apoio
• Planejamento de rotas com análise de infraestrutura
• Modo claro e escuro
• Dados abertos do OpenStreetMap

Pedale com mais segurança. Envie sugestões e ajude a melhorar o mapa da sua cidade.
```

### Notas da versão / release notes (correção — barra de navegação Android, máx. 500 caracteres)

Use after deploying `display: standalone` in `public/manifest.json` and shipping a new AAB
(`bubblewrap update` → `bubblewrap build`):

```
Correção na versão instalada para Android: os botões de navegação do sistema (voltar, início, apps recentes) voltam a ficar visíveis ao abrir o app.

Requer atualização pela Play Store. Se você instalou pelo atalho do Chrome, remova e adicione de novo à tela inicial.
```

---

## 2. Listing assets checklist

| Asset              | Requisito                                 | Status                                |
| ------------------ | ----------------------------------------- | ------------------------------------- |
| Ícone do app       | 512×512 PNG                               | ✓ `public/icon-512.png`               |
| Feature graphic    | 1024×500 PNG/JPG                          | ⬜ a produzir                         |
| Screenshots phone  | mín. 2, entre 320px e 3840px (lado maior) | ⬜ capturar (mapa, rotas, modo claro) |
| Screenshots 7"/10" | opcional                                  | ⬜ opcional                           |
| Vídeo (YouTube)    | opcional                                  | ⬜ opcional                           |

---

## 3. Data Safety form mapping

Preencha em **Play Console → App content → Data safety**. As ferramentas (Google
Analytics, PostHog, Mapbox, Google Places, Airtable, Firestore) atuam como
**operadores/processadores** a serviço do projeto — por isso, em geral, os dados são
**coletados** mas **não "compartilhados"** no sentido da Play (transferência a um
terceiro para uso próprio dele). Confirme as exceções marcadas com ⚠️.

### Visão geral

- **O app coleta ou compartilha dados do usuário?** Sim (coleta).
- **Dados criptografados em trânsito?** Sim (HTTPS em todo o site/TWA).
- **Usuário pode pedir exclusão de dados?** Sim — por e-mail (`contato@ciclomapa.org.br`);
  dados locais podem ser apagados limpando os dados do site no navegador.
- **App voltado a crianças (Families)?** Não.

### Tipos de dados a declarar

| Categoria Play               | Tipo                               | Coletado | Compartilhado | Obrigatório?  | Finalidade(s)                      | Origem no app                                                         |
| ---------------------------- | ---------------------------------- | -------- | ------------- | ------------- | ---------------------------------- | --------------------------------------------------------------------- |
| Localização                  | Localização **precisa**            | Sim      | Não           | Opcional      | Funcionalidade do app              | Botão de geolocalização → reverse geocoding (Google/Mapbox/Nominatim) |
| Localização                  | Localização **aproximada**         | Sim      | Não           | Opcional      | Análise                            | Derivada do IP pelas ferramentas de analytics                         |
| Informações pessoais         | Endereços de e-mail                | Sim      | Não           | Opcional      | Funcionalidade do app; comunicação | Campo opcional ao enviar comentário (Airtable)                        |
| Conteúdo do usuário          | Outro conteúdo gerado pelo usuário | Sim      | Não           | Opcional      | Funcionalidade do app              | Texto do comentário + ponto do mapa (Airtable)                        |
| Atividade no app             | Interações com o app               | Sim      | Não           | Obrigatório\* | Análise                            | GA / PostHog                                                          |
| Informações e desempenho     | Registros de erros (crash)         | Sim      | Não           | Obrigatório\* | Análise; funcionalidade do app     | GA / PostHog                                                          |
| Informações e desempenho     | Diagnóstico                        | Sim      | Não           | Obrigatório\* | Análise                            | GA / PostHog (tipo de aparelho, SO, navegador)                        |
| IDs do dispositivo ou outros | IDs do dispositivo ou outros       | Sim      | Não           | Obrigatório\* | Análise                            | Cookies/IDs de GA e PostHog                                           |

\* "Obrigatório" no sentido de que os dados de analytics são coletados automaticamente
no uso; não há um opt-in dentro do app hoje.

### NÃO coletados (deixar desmarcado)

Nome, dados financeiros/pagamento, saúde e fitness, contatos, mensagens (SMS/e-mail
de terceiros), fotos/vídeos, áudio, arquivos e documentos, agenda, histórico de
navegação na web, orientação sexual/dados sensíveis.

### Pontos a confirmar antes de enviar ⚠️

1. **Dados salvos localmente (favoritos, histórico de rotas, preferências)** ficam só
   no dispositivo e **não** são enviados a um servidor → **não** declarar como coletados.
2. **PostHog**: se a **gravação de sessão (session replay)** ou autocapture de inputs
   estiver ativa, o escopo de coleta aumenta (interações detalhadas, possíveis textos).
   Verifique a configuração e ajuste a declaração se for o caso.
3. **Google Analytics**: se você ativou compartilhamento de dados com o Google
   (Google signals / data sharing), o campo **"Compartilhado"** pode mudar para **Sim**
   em "Atividade no app" e "IDs".
4. **IP**: confirme se é armazenado ou anonimizado pelas ferramentas; isso afeta a
   classificação de "Localização aproximada".

---

## 4. Outros campos de "App content"

- **Privacy policy URL**: `https://ciclomapa.app/privacidade` ✓
- **Content rating**: responder o questionário (esperado: "Livre / Everyone" para um app de mapas).
- **Target audience**: maiores de 13/18; região principal Brasil (e América Latina).
- **Ads**: o app **não** exibe anúncios → declarar "Não".
- **Government app**: Não.

```

```
