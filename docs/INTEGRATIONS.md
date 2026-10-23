# Integrações e dados observados · KernelHub

Pesquisa em **23 de outubro de 2026**. O objetivo é reduzir preenchimento repetitivo e acompanhar dados que realmente existam. Um provedor não precisa preencher todas as métricas: campos ausentes permanecem vazios e não impedem usar o restante do aplicativo.

## Evidência e limites da pesquisa

O ambiente bloqueou o acesso direto aos portais Apple, Garmin, Fitbit, WHOOP, GitHub Docs e Hevy com HTTP CONNECT 403. Não foram ignorados certificados nem contornadas essas restrições. Foi possível consultar a API pública do GitHub com TLS normal, incluindo documentação e exemplos publicados pelos próprios fornecedores em seus repositórios.

**Verificado** abaixo significa conteúdo efetivamente consultado ou resposta HTTP observada. **Proposta** descreve arquitetura do KernelHub. Links dos portais bloqueados são referências a validar antes de implementar autorização em produção; não comprovam elegibilidade, preço, plano comercial ou aprovação de um aplicativo.

## O que pode acompanhar automaticamente

| Fonte          | Evidência consultada                                                                                                                    | Entrega viável                                                                                                                                     | Dependência para automação contínua                                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub público | Endpoint real de eventos retornou 200 e `Access-Control-Allow-Origin: *`; documentação oficial disponível no repositório `github/docs`. | Buscar dados públicos, atualizar com orçamento de requisições, guardar último resultado para consulta offline e indicar quando está desatualizado. | Nenhuma credencial para dados públicos. Dados privados e webhooks pedem backend/autorização.                                                   |
| Apple Saúde    | CareKit publica integração nativa iOS com HealthKit; portal Apple direto bloqueado nesta pesquisa.                                      | Importar uma exportação suportada em lote, com dados e lacunas identificados. É uma fotografia importada, não sincronização contínua.              | Leitura direta do HealthKit exige camada nativa iOS e permissão por tipo. A PWA no Safari não oferece essa ponte por conta própria.            |
| Garmin         | Cliente oficial `garmin/connect-personal-api-python` documenta Personal API com chave e bearer token.                                   | Preparar um adaptador de backend para os conjuntos efetivamente autorizados; importação FIT é alternativa para arquivos compatíveis.               | Chave pessoal/credenciais guardadas no servidor ou armazenamento nativo seguro. Elegibilidade e termos precisam ser confirmados.               |
| Fitbit         | Portal oficial bloqueado; nenhum contrato atual do fornecedor foi confirmado neste ambiente.                                            | Adaptador com métricas opcionais e estado “aguardando conexão”; importar dados suportados quando disponíveis.                                      | Validar a autorização, escopos, políticas e API vigente antes de prometer conexão. Não declarar disponibilidade apenas por existir um card.    |
| WHOOP          | Portal oficial bloqueado; contrato vigente não confirmado nesta pesquisa.                                                               | Preservar métricas próprias separadas das medidas comuns, com ausência permitida.                                                                  | Validar OAuth, escopos e acesso atual. Recovery/Strain não são campos universais do HealthKit.                                                 |
| Hevy           | Repositório `hevyapp/hevy-gpt` publica uma configuração OpenAPI/OAuth com leitura de treinos/rotinas e escrita de rotinas.              | Planejar transferência de uma estrutura revisada e importar execução quando a integração estiver autorizada.                                       | O exemplo do HevyGPT não comprova acesso geral ao mesmo OAuth. Registro de aplicativo, plano e API de produção ainda precisam ser verificados. |

A instalação como PWA não fornece atualização contínua garantida em segundo plano no iPhone. Atualização ao abrir/retornar e enquanto a tela está ativa é uma entrega diferente de ingestão por webhooks ou sincronização nativa.

## GitHub: medir o evento certo

Fontes primárias consultadas: [eventos](https://github.com/github/docs/blob/main/content/rest/activity/events.md), [tipos de evento](https://github.com/github/docs/blob/main/content/rest/using-the-rest-api/github-event-types.md), [commits](https://github.com/github/docs/blob/main/content/rest/commits/commits.md), [deployments](https://github.com/github/docs/blob/main/content/rest/deployments/deployments.md), [limites](https://github.com/github/docs/blob/main/content/rest/using-the-rest-api/rate-limits-for-the-rest-api.md) e [boas práticas](https://github.com/github/docs/blob/main/content/rest/using-the-rest-api/best-practices-for-using-the-rest-api.md).

A consulta real a [`/users/ProgAnakin/events/public`](https://api.github.com/users/ProgAnakin/events/public?per_page=3) trouxe `PushEvent` com `repository_id`, `push_id`, `ref`, `head` e `before`. **Não trouxe a lista de commits nem um campo `size`.** Portanto, quantidade de pushes não pode ser apresentada como quantidade de commits.

- **Atividade/push:** evento publicado no feed, identificado por ID e horário. A documentação limita a timeline a 300 eventos e aos últimos 30 dias; não é histórico completo nem streaming em tempo real.
- **Commit:** obter do endpoint apropriado de commits, com autor/período/repositório definidos. Paginação e limites precisam aparecer quando o resultado estiver incompleto.
- **PR fechado/mesclado:** estados distintos. “Fechado” não significa “mergeado”; a métrica deve informar qual deles conta.
- **Deploy:** usar deployment e estado bem-sucedido, ou uma fonte explícita de implantação. Push, merge e workflow concluído não são automaticamente deploys.
- **Streak:** só calcular quando existe cobertura suficiente de datas; um feed truncado não prova ausência de atividade anterior.

O limite primário documentado para acesso **não autenticado** é 60 requisições/hora por IP. Neste ambiente, a API respondeu com um limite de integração de 15.000, que não representa o navegador público do usuário. Buscas têm limites próprios. Um refresh com vários endpoints precisa compartilhar um orçamento: seis chamadas a cada dez minutos já representam 36 chamadas/hora.

ETag e respostas 304 reduzem tráfego. A documentação de boas práticas garante isenção do limite primário para 304 quando a requisição foi corretamente autorizada; não prometer quota gratuita no modo anônimo. Respeitar `X-Poll-Interval`, `Retry-After` e reset de quota, pausar a página oculta, evitar chamadas duplicadas entre abas e preservar dados antigos com indicação de desatualização.

## Garmin: caminho oficial encontrado

O [cliente oficial Personal API](https://github.com/garmin/connect-personal-api-python) documenta uma chave criada no [Garmin Connect](https://connect.garmin.com/app/settings/personalApiToken), troca por bearer token e wrappers para sono, passos, hidratação, estresse, peso, frequência cardíaca, HRV, Body Battery, resumos diários e atividades. O próprio README remete à [referência Personal API](https://developer.garmin.com/gc-developer-program/personal/personal-api) e ao [Swagger](https://developer.garmin.com/gc-developer-program/personal/swagger-docs/).

Esse cliente é evidência de uma via oficial para uso pessoal; não autoriza supor que todo usuário/dispositivo tem cada conjunto, nem substitui a verificação dos termos. A [Garmin Health API](https://developer.garmin.com/health-api/overview/) deve ser avaliada separadamente para uma integração de produto. Nenhuma senha Garmin, chave pessoal ou bearer deve entrar no bundle estático, URL ou repositório.

O [FIT JavaScript SDK oficial](https://github.com/garmin/fit-javascript-sdk) oferece uma base para ler arquivos FIT em runtime compatível. Ele não equivale a autorização para baixar automaticamente todos os dados da conta.

## Apple Saúde: fonte principal, cobertura variável

Referências: [HealthKit](https://developer.apple.com/documentation/healthkit), [compartilhar/exportar dados](https://support.apple.com/guide/iphone/share-your-health-data-iph5ede58c3d/ios) e [CareKit](https://github.com/carekit-apple/CareKit). O README e os componentes HealthKit do CareKit foram consultados; as páginas Apple diretas ficaram bloqueadas. A exportação real do usuário precisa ser validada contra o importador antes de declarar compatibilidade universal.

A proposta é uma interface única sobre os dados que cada origem compartilhar. Na versão web, importar um arquivo evita digitar medida por medida; ainda requer escolher/exportar o arquivo. Para acompanhamento automático, uma ponte nativa consulta o HealthKit mediante permissão, observa novas amostras e entrega ao mesmo modelo normalizado. Água pode ser registrada no KernelHub e eventualmente escrita no Saúde com permissão própria e deduplicação.

Não assumir que Garmin, Fitbit ou WHOOP compartilham todos os seus campos no Apple Saúde. Medidas comuns e índices proprietários devem continuar separados. Uma métrica ausente fica vazia; um valor zero só existe quando a fonte informou zero para um período conhecido.

## Contrato proposto para métricas opcionais

```ts
type Observation = {
  id: string; // estável para deduplicação
  metric: string; // ex.: steps, sleepMinutes, restingHeartRate, activeKcal
  value: number | null;
  unit: string;
  provider: string;
  sourceRecordId: string | null;
  method: string | null; // ex.: SDNN; não misturar com RMSSD
  startedAt: string | null;
  recordedAt: string | null;
  receivedAt: string;
  localDay: string;
  timeZone: string | null;
  collection: "api" | "native" | "import" | "manual";
  status: "available" | "missing" | "stale" | "permission-denied";
};
```

`receivedAt` informa quando o KernelHub recebeu os dados; não prova quando a pessoa foi medida. A atualização de rede não pode transformar uma medição antiga em “ao vivo”. A conexão também precisa informar estado, última tentativa, último sucesso, cobertura e permissões por grupo de dados.

### Regras de agregação

- Escolher fonte/prioridade por métrica e período. Somar passos do iPhone, relógio e Garmin para o mesmo intervalo pode duplicar a atividade.
- Sono conta intervalos efetivamente classificados como dormindo. “Na cama” e “acordado” não entram como sono; estágios e registros gerais sobrepostos precisam de união/deduplicação. A noite deve ter regra explícita para a data de despertar.
- Frequência em repouso, última amostra e média diária são métricas distintas. HRV também precisa preservar método e unidade.
- Calorias ativas e basais são distintas. A energia dos treinos pode já integrar o total diário; não somá-la duas vezes.
- Guardar lacunas nos gráficos. Não preencher dados ausentes com zero, média inventada ou um score demonstrativo.
- Comparar períodos equivalentes. Passos às 9h não são comparáveis a um dia inteiro sem deixar isso explícito.
- Índices proprietários de prontidão não são intercambiáveis. Não criar um score global “de saúde” a partir de métricas heterogêneas sem metodologia validada e cobertura conhecida.

## Sequência de entrega recomendada

1. **Agora, frontend estático:** GitHub público com atualização automática limitada; cronômetro de foco real; importação em lote suportada; tendências e contexto calculados apenas com dados existentes. Mostrar o que está conectado, importado, manual ou demonstrativo.
2. **Conexão pessoal segura:** backend/ponte para credenciais Garmin Personal API ou provedores autorizados, com escopos mínimos, armazenamento seguro, revogação e registros de sincronização. Não solicitar tokens como texto em um card da PWA.
3. **Acompanhamento iOS contínuo:** camada nativa HealthKit e validação física, mantendo a UI web se a arquitetura escolhida permitir. Permissões e disponibilidade variam por tipo e origem.
4. **Integrações de produto:** validar contratos Fitbit/WHOOP, Hevy e os termos de distribuição; implementar OAuth, webhooks assinados, deduplicação, erros e exclusão/revogação antes de anunciar suporte automático.

Estas são recomendações e contratos de integração, não uma declaração de que os conectores já estão implementados. A experiência deve devolver tendências, mudanças e próximos passos úteis sem transferir ao usuário o trabalho de recompor uma planilha.
