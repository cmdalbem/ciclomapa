import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Button, Collapse } from 'antd';
import { HiOutlineXMark } from 'react-icons/hi2';

import Logo from './components/Logo';
import { handleModalKeyDown, setupModalFocus, restoreModalFocus } from './modalFocusTrap';

const CONTACT_EMAIL = 'contato@ciclomapa.org.br';
const LAST_UPDATED = '31/05/2026';

const paragraphClass = 'text-sm sm:text-base leading-relaxed text-gray-300 mb-3';
const listClass =
  'list-disc pl-5 space-y-1.5 text-sm sm:text-base text-gray-300 mb-3 marker:text-gray-500';
const subHeadingClass = 'text-base font-semibold text-white mt-5 mb-2';
const linkClass = 'underline decoration-dotted text-current font-medium hover:text-white';

function MailLink() {
  return (
    <a className={linkClass} href={`mailto:${CONTACT_EMAIL}`}>
      {CONTACT_EMAIL}
    </a>
  );
}

const TLDR_ITEMS = [
  'Você pode usar o CicloMapa sem cadastro ou login, e coletamos o mínimo possível de dados pessoais;',
  'Se você usar a localização, ela serve apenas para mostrar onde você está no mapa e a permissão é controlada pelo seu navegador;',
  'Alguns dados como favoritos e histórico de rotas podem ficar salvos no seu próprio navegador — como uma memória local dos seus caminhos;',
  'Se você enviar um comentário, pode fazer isso de forma anônima, e informar o e-mail é opcional;',
  'Usamos ferramentas como Google Analytics e PostHog para entender o uso da plataforma, corrigir problemas e melhorar a experiência de quem pedala;',
  'Alguns fornecedores técnicos podem tratar dados para manter o CicloMapa funcionando, como serviços de nuvem, analytics, banco de dados e gestão de comentários;',
];

const COOKIE_ROWS = [
  {
    name: '_ga',
    tool: 'Google Analytics',
    purpose: 'Identificação estatística de usuários',
    category: 'Analytics',
  },
  {
    name: '_ga_<id>',
    tool: 'Google Analytics',
    purpose: 'Acompanhamento de sessão',
    category: 'Analytics',
  },
  {
    name: 'ph_phc_*',
    tool: 'PostHog',
    purpose: 'Análise de uso, comportamento e melhoria do produto',
    category: 'Analytics',
  },
];

function getSections() {
  return [
    {
      key: '1',
      title: '1. Quem é responsável pelo CicloMapa',
      body: (
        <>
          <p className={paragraphClass}>
            O CicloMapa é uma iniciativa mantida em parceria pela UCB — União de Ciclistas do Brasil
            e o ITDP — Instituto de Políticas de Transporte e Desenvolvimento do Brasil,
            organizações sem fins lucrativos ligadas à mobilidade por bicicleta e ao acesso a dados
            cicloviários.
          </p>
          <p className={paragraphClass}>
            Para fins deste Aviso de Privacidade, essas instituições atuam como responsáveis pela
            coordenação e manutenção do CicloMapa, nos termos definidos nos contratos aplicáveis ao
            projeto.
          </p>
          <p className={paragraphClass}>
            A operação do CicloMapa é coordenada por Cristiano Dalbem, que atua como ponto central
            de administração e coordenação operacional da plataforma, conforme os acordos internos
            do projeto.
          </p>
        </>
      ),
    },
    {
      key: '2',
      title: '2. Para quem o CicloMapa foi feito?',
      body: (
        <>
          <p className={paragraphClass}>O CicloMapa foi criado principalmente para:</p>
          <ul className={listClass}>
            <li>ciclistas e pessoas que se deslocam de bicicleta;</li>
            <li>
              cidadãos interessados em conhecer melhor a infraestrutura cicloviária das cidades;
            </li>
            <li>pesquisadores, universidades e organizações da sociedade civil;</li>
            <li>gestores públicos e equipes técnicas que trabalham com mobilidade urbana;</li>
            <li>pessoas e grupos que contribuem com dados abertos e mapeamento colaborativo.</li>
          </ul>
          <p className={paragraphClass}>
            A plataforma é dedicada ao uso no Brasil, mas pode ser acessada de qualquer lugar do
            mundo.
          </p>
        </>
      ),
    },
    {
      key: '3',
      title: '3. Que tipos de dados o CicloMapa trata?',
      body: (
        <>
          <p className={paragraphClass}>
            O CicloMapa não exige cadastro ou login para uso geral da plataforma. É possível acessar
            o mapa, visualizar ciclovias, ciclofaixas, bicicletários, oficinas, estações de
            bicicleta compartilhada e outras informações sem informar qualquer tipo de dado pessoal
            que permita a identificação individual do usuário.
          </p>
          <p className={paragraphClass}>
            Ainda assim, algumas funcionalidades podem envolver os seguintes tipos de dados:
          </p>

          <h4 className={subHeadingClass}>3.1. Localização do dispositivo</h4>
          <p className={paragraphClass}>
            Ao clicar no botão de localização do mapa, seu navegador pode pedir autorização para
            acessar a localização do seu dispositivo. Essa autorização é controlada pelo próprio
            navegador ou sistema operacional, e o CicloMapa usa essa informação para mostrar onde
            você está no mapa e facilitar sua navegação.
          </p>
          <p className={paragraphClass}>
            A localização é usada unicamente para a funcionalidade de te permitir se localizar no
            mapa, e não é usada para identificá-lo. Você pode autorizar, negar ou revogar essa
            autorização diretamente nas configurações do seu navegador ou dispositivo.
          </p>

          <h4 className={subHeadingClass}>3.2. Dados salvos localmente no seu navegador</h4>
          <p className={paragraphClass}>
            Algumas informações podem ficar salvas no seu próprio navegador, como:
          </p>
          <ul className={listClass}>
            <li>histórico de rotas consultadas;</li>
            <li>locais ou rotas favoritas;</li>
            <li>preferências de navegação ou uso do mapa.</li>
          </ul>
          <p className={paragraphClass}>
            Esses dados ficam armazenados localmente no dispositivo/navegador usado por você — o que
            significa que, em regra, eles não são enviados para uma base central do CicloMapa, e
            você pode apagar essas informações limpando os dados do site no seu navegador.
          </p>

          <h4 className={subHeadingClass}>3.3. Comentários enviados no mapa</h4>
          <p className={paragraphClass}>
            Na versão web do CicloMapa, você pode enviar comentários para reportar erros, sugestões
            ou observações sobre um ponto do mapa — esses comentários ajudam a melhorar a qualidade
            dos dados e podem auxiliar pessoas parceiras e editoras do OpenStreetMap.
          </p>
          <p className={paragraphClass}>
            Ao enviar um comentário, você pode opcionalmente informar um e-mail, porém também é
            possível enviar comentários de forma anônima.
          </p>
          <p className={paragraphClass}>Quando você envia um comentário, serão tratados:</p>
          <ul className={listClass}>
            <li>texto do comentário;</li>
            <li>local ou ponto do mapa relacionado ao comentário;</li>
            <li>e-mail, se você decidir informar;</li>
            <li>
              informações técnicas do navegador, como user agent, para ajudar na análise do
              comentário e em eventuais problemas técnicos.
            </li>
          </ul>
          <p className={paragraphClass}>
            Os comentários e dados associados são armazenados em ferramenta de gestão usada pelo
            projeto, como Airtable, e ficam visíveis apenas para administradores autorizados do
            CicloMapa.
          </p>

          <h4 className={subHeadingClass}>3.4. Dados técnicos e de uso da plataforma</h4>
          <p className={paragraphClass}>
            O CicloMapa pode usar ferramentas de análise para entender como a plataforma é usada,
            identificar problemas, melhorar funcionalidades e priorizar ajustes técnicos.
          </p>
          <p className={paragraphClass}>Essas ferramentas podem coletar informações como:</p>
          <ul className={listClass}>
            <li>páginas ou telas acessadas;</li>
            <li>interações com funcionalidades;</li>
            <li>tipo de dispositivo;</li>
            <li>sistema operacional;</li>
            <li>tipo e versão do navegador;</li>
            <li>informações derivadas do endereço de IP;</li>
            <li>registros técnicos de erro ou funcionamento;</li>
            <li>dados agregados sobre uso da plataforma.</li>
          </ul>
          <p className={paragraphClass}>
            Essas informações ajudam o projeto a entender, por exemplo, se uma funcionalidade está
            performando como esperado, quais partes do mapa são mais acessadas, se há erros técnicos
            e como melhorar a experiência de quem usa o CicloMapa.
          </p>

          <h4 className={subHeadingClass}>3.5. Dados de crianças e adolescentes</h4>
          <p className={paragraphClass}>
            O CicloMapa é uma plataforma aberta, gratuita e voltada ao público em geral, porém não é
            direcionada especificamente a crianças e não solicita intencionalmente dados pessoais de
            crianças ou adolescentes.
          </p>
          <p className={paragraphClass}>
            Caso os responsáveis legais identifiquem que uma criança forneceu dados pessoais ao
            CicloMapa, podem entrar em contato pelo e-mail <MailLink /> para solicitar análise,
            correção ou exclusão das informações, quando aplicável.
          </p>
        </>
      ),
    },
    {
      key: '4',
      title: '4. Cookies e tecnologias semelhantes',
      body: (
        <>
          <p className={paragraphClass}>
            Cookies são pequenos arquivos salvos no seu navegador para permitir algumas
            funcionalidades, lembrar as preferências dos usuários ou entender como as pessoas usam
            uma página. No caso do CicloMapa, cookies e tecnologias similares são utilizados
            exclusivamente para fins de análise e melhoria da plataforma.
          </p>

          <div className="my-4 overflow-x-auto rounded-xl border border-white border-opacity-10 bg-black bg-opacity-20">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white border-opacity-15">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Nome
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Ferramenta
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Finalidade
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Categoria
                  </th>
                </tr>
              </thead>
              <tbody>
                {COOKIE_ROWS.map((row) => (
                  <tr
                    key={row.name}
                    className="border-b border-white border-opacity-10 last:border-0 align-top"
                  >
                    <td className="px-4 py-3">
                      <code className="font-mono text-xs text-gray-100">{row.name}</code>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{row.tool}</td>
                    <td className="px-4 py-3 text-gray-300">{row.purpose}</td>
                    <td className="px-4 py-3 text-gray-300">{row.category}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className={paragraphClass}>
            Esses cookies auxiliam no entendimento do uso da plataforma, e também a encontrar
            problemas e melhorar o serviço fornecido, todos de forma anonimizada.
          </p>
          <p className={paragraphClass}>
            Seguindo o previsto pelo Art. 7º, Inciso IX da Lei Geral de Proteção de Dados (Lei nº
            13.709/18), o tratamento associado a essas tecnologias se baseia no legítimo interesse
            do projeto em melhorar, proteger e desenvolver uma plataforma gratuita e colaborativa,
            sempre respeitando os direitos e expectativas das pessoas usuárias.
          </p>
          <p className={paragraphClass}>
            Contudo, você pode limitar ou bloquear cookies diretamente nas configurações do seu
            navegador.
          </p>
        </>
      ),
    },
    {
      key: '5',
      title: '5. Para que usamos os dados?',
      body: (
        <>
          <p className={paragraphClass}>
            O CicloMapa trata dados pessoais apenas quando existe uma finalidade legítima e
            relacionada à plataforma. As principais finalidades são:
          </p>

          <h4 className={subHeadingClass}>Mostrar sua localização no mapa</h4>
          <p className={paragraphClass}>
            Quando você autoriza o navegador a acessar sua localização, esse dado é usado para
            posicionar você no mapa e facilitar sua navegação.
          </p>

          <h4 className={subHeadingClass}>Permitir comentários e sugestões</h4>
          <p className={paragraphClass}>
            Ao enviar um comentário para a plataforma, as informações fornecidas são usadas para:
          </p>
          <ul className={listClass}>
            <li>entender o problema ou sugestão;</li>
            <li>analisar e atuar em eventuais erros ou inconsistências na plataforma;</li>
            <li>
              caso tenha optado por fornecer endereço de e-mail, para entrar em contato com você, se
              necessário.
            </li>
          </ul>

          <h4 className={subHeadingClass}>Melhorar o funcionamento da plataforma</h4>
          <p className={paragraphClass}>Dados técnicos e de uso podem ser usados para:</p>
          <ul className={listClass}>
            <li>identificar erros e bugs e avaliar desempenho da plataforma;</li>
            <li>entender como as pessoas usam o mapa;</li>
            <li>melhorar funcionalidades e priorizar essas melhorias;</li>
            <li>tornar a experiência mais simples e amigável ao usuário.</li>
          </ul>

          <h4 className={subHeadingClass}>Proteger a plataforma</h4>
          <p className={paragraphClass}>
            Informações técnicas também podem ser usadas para manter a segurança, prevenir uso de
            má-fé, investigar falhas e garantir a estabilidade do serviço.
          </p>

          <h4 className={subHeadingClass}>Produzir métricas agregadas</h4>
          <p className={paragraphClass}>
            O CicloMapa pode usar dados estatísticos para entender o alcance da plataforma, apoiar
            relatórios, estudos, pesquisas e decisões relacionadas à mobilidade por bicicleta.
            Sempre que possível, essas análises são feitas de forma agregada, sem identificar
            diretamente quem usa a plataforma.
          </p>
        </>
      ),
    },
    {
      key: '6',
      title: '6. Bases legais para o tratamento',
      body: (
        <>
          <p className={paragraphClass}>
            Nos termos da LGPD (Lei nº 13.709/18), o tratamento de dados pessoais pelo CicloMapa
            pode se justificar pela aplicação das seguintes bases legais, conforme o caso:
          </p>

          <h4 className={subHeadingClass}>Consentimento</h4>
          <p className={paragraphClass}>
            Usado quando você escolhe permitir o acesso à localização pelo navegador ou quando
            informa voluntariamente seu e-mail ao enviar um comentário.
          </p>

          <h4 className={subHeadingClass}>Legítimo interesse</h4>
          <p className={paragraphClass}>
            Usado para atividades necessárias à melhoria, segurança, análise técnica e evolução da
            plataforma, desde que respeitados seus direitos e liberdades fundamentais. Isso inclui,
            por exemplo, análise de uso, identificação de bugs, métricas de produto e prevenção de
            falhas.
          </p>

          <h4 className={subHeadingClass}>Cumprimento de obrigação legal ou regulatória</h4>
          <p className={paragraphClass}>
            Usado caso o CicloMapa precise manter ou compartilhar informações para cumprir
            obrigações legais, ordens de autoridades competentes ou exercer direitos em processos
            administrativos, judiciais ou arbitrais.
          </p>
        </>
      ),
    },
    {
      key: '7',
      title: '7. Como funciona a sugestão de rotas?',
      body: (
        <>
          <p className={paragraphClass}>
            O CicloMapa pode sugerir rotas usando os dados disponíveis sobre infraestrutura
            cicloviária, como ciclovias, ciclofaixas, ciclorrotas, vias compartilhadas e vias de
            baixa velocidade. Ao calcular uma rota, o sistema analisa quais tipos de infraestrutura
            aparecem ao longo do trajeto e atribui pesos diferentes a esses elementos, considerando
            o nível de proteção que podem oferecer para quem pedala — com isso, o CicloMapa ajuda
            você a comparar caminhos possíveis.
          </p>
          <p className={paragraphClass}>
            <strong className="text-white">Importante:</strong> essas rotas são sugestões
            automáticas, baseadas nos dados disponíveis no mapa no momento da consulta, e elas não
            garantem que o trajeto seja o mais seguro, mais rápido ou mais adequado em todas as
            situações. Antes de pedalar, confira sempre as condições reais da via, a sinalização, o
            trânsito, a iluminação, obras, obstáculos e sua própria percepção de segurança.
          </p>
          <p className={paragraphClass}>
            O CicloMapa não usa seu histórico pessoal de rotas para tomar decisões sobre você. As
            sugestões servem apenas para apoiar a navegação e facilitar o acesso a informações sobre
            a infraestrutura cicloviária.
          </p>
        </>
      ),
    },
    {
      key: '8',
      title: '8. Com quem os dados podem ser compartilhados?',
      body: (
        <>
          <p className={paragraphClass}>
            O CicloMapa pode compartilhar dados com fornecedores técnicos necessários para a
            manutenção e melhoria da plataforma — tais prestadores de serviço devem tratar os dados
            conforme as finalidades definidas pelo projeto.
          </p>
          <p className={paragraphClass}>
            As principais integrações e fornecedores identificados são:
          </p>
          <ul className={listClass}>
            <li>
              <strong className="text-white">PostHog:</strong> usado para análise de produto,
              comportamento de uso, identificação de bugs e viabilização de melhoria da plataforma.
            </li>
            <li>
              <strong className="text-white">Google Analytics:</strong> usado para métricas de
              acesso, audiência e uso da plataforma.
            </li>
            <li>
              <strong className="text-white">Hotjar:</strong> quando ativado, é utilizado para
              surveys, pesquisas ou coleta de feedback sobre a experiência de uso.
            </li>
            <li>
              <strong className="text-white">Airtable:</strong> usado para armazenar e organizar
              comentários enviados por pessoas usuárias, incluindo e-mail opcional e informações
              técnicas associadas.
            </li>
          </ul>

          <h4 className={subHeadingClass}>Serviços de infraestrutura e banco de dados</h4>
          <p className={paragraphClass}>
            O CicloMapa usa serviços técnicos para hospedar e operar a plataforma, incluindo:
          </p>
          <ul className={listClass}>
            <li>
              AWS, para informações de infraestrutura cicloviária e hospedagem/serviços
              relacionados;
            </li>
            <li>Firebase, como banco de dados de infraestrutura do app;</li>
            <li>Google Maps APIs, para funcionalidades de busca e apoio à navegação;</li>
            <li>Vercel, para hospedagem e entrega da aplicação.</li>
          </ul>
          <p className={paragraphClass}>
            O CicloMapa também usa dados do OpenStreetMap, uma base aberta e colaborativa de mapas.
            Comentários enviados no CicloMapa podem auxiliar pessoas parceiras e editoras a corrigir
            ou melhorar informações no OpenStreetMap, mas o envio de comentários no CicloMapa não
            significa que seu e-mail (caso fornecido) será publicado ou compartilhado ao
            OpenStreetMap.
          </p>
        </>
      ),
    },
    {
      key: '9',
      title: '9. Quem tem acesso aos dados?',
      body: (
        <>
          <p className={paragraphClass}>
            O acesso aos dados pessoais tratados pelo CicloMapa é restrito a pessoas autorizadas que
            precisam dessas informações para operar, manter, analisar ou melhorar a plataforma.
          </p>
          <p className={paragraphClass}>
            No caso de comentários enviados no mapa, o acesso fica limitado aos administradores
            autorizados do CicloMapa.
          </p>
          <p className={paragraphClass}>
            Fornecedores técnicos também podem tratar dados quando isso for necessário para prestar
            seus serviços, sempre conforme as finalidades descritas neste Aviso de Privacidade.
          </p>
        </>
      ),
    },
    {
      key: '10',
      title: '10. Onde os dados ficam armazenados e por quanto tempo?',
      body: (
        <>
          <p className={paragraphClass}>
            O CicloMapa mantém dados pessoais apenas pelo tempo necessário para cumprir as
            finalidades descritas neste Aviso, salvo quando houver necessidade de retenção por
            obrigação legal, segurança, prevenção de fraude, exercício de direitos ou melhoria
            técnica da plataforma.
          </p>

          <h4 className={subHeadingClass}>Localização e rotas salvas no navegador</h4>
          <p className={paragraphClass}>
            Dados como histórico de rotas e favoritos podem ficar armazenados localmente no seu
            próprio navegador/dispositivo. Você controla esses dados e pode apagá-los limpando os
            dados do site nas configurações do navegador.
          </p>

          <h4 className={subHeadingClass}>Dados de analytics no PostHog</h4>
          <p className={paragraphClass}>
            Os dados tratados no PostHog são mantidos por até 30 dias.
          </p>

          <h4 className={subHeadingClass}>Comentários e e-mail opcional no Airtable</h4>
          <p className={paragraphClass}>
            Comentários enviados no mapa, e eventual e-mail informado voluntariamente, ficam
            armazenados no Airtable enquanto forem necessários para análise, gestão dos comentários,
            melhoria do mapa, documentação do projeto ou cumprimento de obrigações aplicáveis.
          </p>

          <h4 className={subHeadingClass}>Logs e dados técnicos</h4>
          <p className={paragraphClass}>
            Logs técnicos e informações de funcionamento podem ser mantidos pelo tempo necessário
            para segurança, diagnóstico de falhas, auditoria técnica e estabilidade da plataforma.
          </p>
        </>
      ),
    },
    {
      key: '11',
      title: '11. Transferências internacionais de dados',
      body: (
        <>
          <p className={paragraphClass}>
            Embora o CicloMapa seja voltado principalmente ao Brasil, algumas ferramentas e serviços
            usados pela plataforma podem armazenar ou processar dados fora do Brasil. Isso pode
            ocorrer, por exemplo, com serviços de analytics, banco de dados, hospedagem, nuvem ou
            suporte técnico.
          </p>
          <p className={paragraphClass}>
            Quando houver transferência internacional de dados pessoais, o CicloMapa buscará adotar
            medidas compatíveis com a LGPD, como uso de fornecedores com compromissos contratuais de
            proteção de dados, adoção de medidas técnicas e organizacionais de segurança e limitação
            dos dados compartilhados ao necessário.
          </p>
        </>
      ),
    },
    {
      key: '12',
      title: '12. Segurança dos dados',
      body: (
        <>
          <p className={paragraphClass}>
            O CicloMapa adota medidas técnicas e organizacionais para proteger os dados tratados
            pela plataforma. Entre as medidas informadas estão:
          </p>
          <ul className={listClass}>
            <li>uso de HTTPS para proteção da comunicação entre seu navegador e a plataforma;</li>
            <li>
              restrição de acesso aos dados de produção apenas a pessoas autorizadas ligadas à
              operação do CicloMapa;
            </li>
            <li>
              limitação da coleta de dados pessoais ao necessário, além do armazenamento local, no
              próprio navegador do usuário, de determinadas informações de uso, como favoritos e
              histórico de rotas.
            </li>
          </ul>
          <p className={paragraphClass}>
            Apesar dessas medidas, nenhum sistema é completamente imune a falhas, ataques ou acessos
            indevidos. Por isso, o CicloMapa busca manter práticas adequadas de segurança e melhoria
            contínua.
          </p>
        </>
      ),
    },
    {
      key: '13',
      title: '13. Seus direitos como titular de dados',
      body: (
        <>
          <p className={paragraphClass}>
            A LGPD garante uma série de direitos às pessoas titulares de dados pessoais. Você pode
            solicitar, conforme aplicável:
          </p>
          <ul className={listClass}>
            <li>confirmação de que tratamos seus dados pessoais;</li>
            <li>acesso aos seus dados;</li>
            <li>correção de dados incompletos, inexatos ou desatualizados;</li>
            <li>
              anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados
              em desconformidade com a LGPD;
            </li>
            <li>
              portabilidade dos dados, quando aplicável e conforme regulamentação da autoridade
              competente;
            </li>
            <li>informação sobre compartilhamento de dados;</li>
            <li>
              informação sobre a possibilidade de não fornecer consentimento e sobre as
              consequências dessa negativa;
            </li>
            <li>revogação do consentimento, quando o tratamento se basear em consentimento;</li>
            <li>oposição ao tratamento, quando aplicável;</li>
            <li>
              revisão de decisões tomadas unicamente com base em tratamento automatizado de dados
              pessoais, quando houver.
            </li>
          </ul>
          <p className={paragraphClass}>
            Para exercer seus direitos, entre em contato pelo e-mail: <MailLink />
          </p>
          <p className={paragraphClass}>
            Ao receber uma solicitação, poderemos pedir informações adicionais para confirmar sua
            identidade e localizar os dados relacionados ao pedido.
          </p>
        </>
      ),
    },
    {
      key: '14',
      title: '14. Alterações do Aviso',
      body: (
        <>
          <p className={paragraphClass}>
            Este Aviso de Privacidade pode ser atualizado a qualquer momento para refletir mudanças
            no CicloMapa, nas ferramentas usadas, na legislação ou nas práticas de privacidade do
            projeto.
          </p>
          <p className={paragraphClass}>
            Quando houver mudanças relevantes, o CicloMapa poderá destacar a atualização na própria
            plataforma ou por outros meios adequados.
          </p>
          <p className={paragraphClass}>
            A data da última atualização estará sempre indicada no início deste Aviso.
          </p>
        </>
      ),
    },
    {
      key: '15',
      title: '15. Fale com o CicloMapa',
      body: (
        <p className={paragraphClass}>
          Se você tiver dúvidas sobre este Aviso de Privacidade, sobre o uso dos seus dados ou
          quiser exercer seus direitos previstos na LGPD, entre em contato via: <MailLink />
        </p>
      ),
    },
  ];
}

function PrivacyPolicyModal({ visible, onClose }) {
  const modalRef = useRef(null);
  const previousActiveElementRef = useRef(null);

  useEffect(() => {
    if (!visible) return;
    setupModalFocus(modalRef, previousActiveElementRef);
    const boundKeyDown = (e) => handleModalKeyDown(e, modalRef, onClose);
    document.addEventListener('keydown', boundKeyDown);
    return () => {
      document.removeEventListener('keydown', boundKeyDown);
      restoreModalFocus(previousActiveElementRef);
    };
  }, [visible, onClose]);

  const sections = useMemo(() => getSections(), []);
  const allSectionKeys = useMemo(() => sections.map((section) => section.key), [sections]);
  const [activeKeys, setActiveKeys] = useState([]);

  const allExpanded =
    allSectionKeys.length > 0 &&
    activeKeys.length === allSectionKeys.length &&
    allSectionKeys.every((key) => activeKeys.includes(key));

  useEffect(() => {
    if (!visible) setActiveKeys([]);
  }, [visible]);

  const collapseItems = sections.map((section) => ({
    key: section.key,
    label: <span className="font-semibold text-white">{section.title}</span>,
    children: section.body,
  }));

  const handleCollapseChange = (keys) => {
    setActiveKeys(Array.isArray(keys) ? keys : keys != null ? [keys] : []);
  };

  const toggleExpandAll = () => {
    setActiveKeys(allExpanded ? [] : allSectionKeys);
  };

  return (
    <div
      ref={modalRef}
      id="privacy-policy-modal"
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Aviso de Privacidade do CicloMapa"
      className={`
        app-modal-root fixed bg-gray-800 text-gray-100 antialiased overflow-hidden
        bottom-0 left-0 right-0 top-3 rounded-tl-2xl rounded-tr-2xl
        transform will-change-transform
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12 pointer-events-none'}
        transition-all duration-500 ease-out
        md:inset-0 md:rounded-none md:translate-y-0
      `}
    >
      <div id="privacy-policy-scroll" className="absolute inset-x-0 top-0 bottom-0 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          <div className="sticky top-0 z-20 px-3 pt-4 pb-3 bg-gray-800">
            <div className="flex items-center justify-between gap-4 mb-4">
              <Logo className="text-base opacity-80" />
              <Button
                type="text"
                onClick={onClose}
                shape="circle"
                aria-label="Fechar aviso de privacidade"
                className="text-gray-300 hover:text-white"
              >
                <HiOutlineXMark className="text-2xl" aria-hidden />
              </Button>
            </div>
            <h2 className="text-3xl sm:text-4xl leading-tight font-heading-display text-white my-0">
              Aviso de Privacidade
            </h2>
            <p className="text-xs uppercase tracking-wide text-gray-500 mt-2 mb-0">
              Última atualização: {LAST_UPDATED}
            </p>
          </div>

          <div className="px-3 pt-6 pb-10">
            <section
              aria-label="Resumo"
              className="rounded-2xl border border-white border-opacity-10 bg-gray-900 bg-opacity-80 p-4 sm:p-5 mb-8"
            >
              <h3 className="text-lg font-semibold text-white mt-0 mb-3">TL;DR</h3>
              <ul className={listClass + ' mb-3'}>
                {TLDR_ITEMS.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
              <p className="text-sm sm:text-base leading-relaxed text-gray-300 m-0">
                📩 Quer acessar, corrigir ou excluir seus dados? Fale com a gente pelo <MailLink />.
              </p>
            </section>

            <p className={paragraphClass}>
              O CicloMapa existe para ajudar quem pedala, pesquisa, planeja ou trabalha com
              mobilidade urbana a encontrar e usar informações sobre a infraestrutura cicloviária no
              Brasil.
            </p>
            <p className={paragraphClass}>
              Aqui explicamos, de forma simples e transparente, quais dados pessoais podem ser
              tratados quando você usa o CicloMapa, por que eles são usados, com quem podem ser
              compartilhados, por quanto tempo são mantidos e quais são os seus direitos.
            </p>
            <p className={paragraphClass}>
              Para a funcionalidade da plataforma, coletamos o mínimo possível de dados pessoais e a
              maior parte das informações exibidas no mapa vem de bases abertas e colaborativas,
              como o OpenStreetMap — que não depende da identificação de quem as usa. Algumas
              funcionalidades, porém, podem envolver dados pessoais, como sua localização
              aproximada, informações técnicas de navegação e, se você quiser, seu e-mail ao enviar
              um comentário no mapa.
            </p>

            <Collapse items={collapseItems} accordion className="mt-6" />
          </div>
        </div>
      </div>
    </div>
  );
}

PrivacyPolicyModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default PrivacyPolicyModal;
