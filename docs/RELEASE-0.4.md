# Revisão da versão 0.4

23 de outubro de 2026. A base anterior era a versão 0.3.1 (`3b5c473`). Esta entrega muda a experiência diária e acrescenta acompanhamento a partir de fontes reais.

## O que mudou para quem usa

- **Hoje:** panorama redesenhado, contraste mais forte, tipografia numérica, séries com lacunas e origem das leituras. Prévia ilustrativa fica identificada; uma importação parcial substitui a prévia inteira, sem completar medidas ausentes com fixtures.
- **Fontes:** GitHub público conectado por usuário e importação local do XML do Apple Saúde. Oito métricas opcionais compartilham unidade, data, origem e cobertura. Nenhum dispositivo precisa fornecer todos os campos.
- **Foco:** cronômetro mede tempo por timestamps, permite pausa, retoma depois de recarregar e mostra o bloco ativo no panorama. Concluir registra e consome a sessão na mesma transação.
- **Contexto:** sono comparado à meta configurada; frequência em repouso comparada à média de pelo menos três registros anteriores, com tamanho da amostra explícito. Sem score clínico ou associação causal inventada.
- **Navegação:** central de fontes na barra inferior; ações manuais disponíveis como complemento. Corpo, evolução e coleção preservam registros corrigíveis da versão anterior.

## Bugs encontrados e corrigidos nesta entrega

| Problema                                                                           | Correção e evidência                                                                                                                                                       |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atualizar/reconectar GitHub apagava a leitura anterior antes de receber a resposta | Mesma conta preserva o snapshot; outra conta é buscada antes de substituir. Falhas de rede e respostas antigas após desconexão têm regressões no browser.                  |
| Importação pendente podia restaurar saúde apagada em outra aba                     | Revisão e tombstone persistidos; comparação e gravação na mesma transação. Testado também sem BroadcastChannel.                                                            |
| Importador não funcionava com o runtime do worker de produção                      | Worker clássico compatível com o bootstrap compilado; processamento continua fora da thread da interface.                                                                  |
| Cache offline retirava o fragmento de configuração do bootstrap do worker          | Resposta sintética somente para destino worker preserva a URL original. Primeira importação offline testada depois da primeira visita online.                              |
| Chunks exclusivos do worker não apareciam no HTML e podiam faltar offline          | Manifesto de precache gerado por build, com revisão SHA e caminhos limitados ao app. Atualização verifica o script importado; instalação inválida não troca o cache ativo. |
| Água arredondava 1,75 L para 1,8 L no panorama                                     | Exibição mantém duas casas quando necessárias.                                                                                                                             |
| Metadados do shell tinham contraste insuficiente e atributo ARIA inválido          | Contraste aumentado e papel semântico corrigido; verificações de acessibilidade automatizada passaram.                                                                     |
| Sono antigo podia aparecer com a data da última métrica do arquivo                 | A medida principal usa a data da própria leitura de sono.                                                                                                                  |

| Voltar ao build normal após exportar Pages incluía assets TS gerados na checagem | A pasta de saída `out/` foi excluída do programa TypeScript; o ciclo exportar → build normal foi validado. |

## Validação

- 55 testes unitários de domínio, importação, GitHub, timer e entradas adversariais.
- 62 cenários de interface anteriores adaptados à nova navegação, em iPhone emulado e desktop: persistência, concorrência, falhas, recuperação, datas/fusos, controles e acessibilidade.
- 10 cenários novos de fontes/timer nos dois viewports: conexão, falha/reconexão, XML parcial/hostil, primeira importação offline, exclusão entre abas, pausa/recarga/conclusão única.
- TypeScript, formatação, build de produção e auditoria de dependências sem vulnerabilidades reportadas pelo npm nesta execução.
- Exportação Pages verificada separadamente: base `/KernelHub/`, assets, manifesto, navegação com rede travada, registros offline e primeira importação XML offline com persistência e ausência preservada.

Os testes automatizados usam Chromium. Safari físico, instalação na tela de início, teclado, VoiceOver e permissões de uma futura camada nativa continuam pendentes. Não se trata de certificação de segurança ou pentest de infraestrutura externa.

## Performance

O importador processa XML em um Web Worker, com limite de 12 MiB e 150 mil registros. O GitHub usa atualização mínima de dez minutos enquanto visível, cooldown e respeito à quota; a página oculta não mantém polling. Relógios da interface dormem quando ocultos, e os ticks do foco ficam isolados no card.

Uma execução local em Chromium, viewport iPhone, CPU 4× e rede de 1,6 Mbps/150 ms registrou FCP e LCP de 1.144 ms e CLS 0. É uma observação de laboratório, sem comparação controlada que demonstre ganho sobre a versão anterior e sem validade como métrica de produção. O build examinado continha cerca de 303 KiB de JS e 21 KiB de CSS em gzip, somando todos os chunks públicos, inclusive os do worker. Não representa apenas o JavaScript inicial transferido.

## O que permanece para os próximos ciclos

A sincronização contínua de saúde exige uma ponte nativa HealthKit ou conectores autorizados com backend. A importação XML atual é pontual e limitada; arquivos maiores precisam de outro fluxo. GitHub público não inclui repositórios privados e seu feed de até 100 eventos não prova a totalidade das contribuições. Commits e deploys desconhecidos ficam vazios.

Cadastro livre de cursos/hábitos, avaliação de aprendizagem aplicada, agentes de treino/suplementação e passagem de planos ao Hevy continuam no roadmap. A pesquisa de mercado está documentada com seus bloqueios de acesso em [MARKET-RESEARCH.md](MARKET-RESEARCH.md); caminhos oficiais de integração verificados constam em [INTEGRATIONS.md](INTEGRATIONS.md).

Os dados ficam em IndexedDB, sem criptografia do aplicativo ou backup remoto. O backup JSON inclui os registros do KernelHub e blocos concluídos; snapshots de fontes e timer ativo são separados. Outras páginas na mesma origem Pages compartilham o acesso ao armazenamento. Consulte [SECURITY.md](../SECURITY.md).
