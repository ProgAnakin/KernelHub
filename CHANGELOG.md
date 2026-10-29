# Evolução do KernelHub

## 0.5.0 · 29 de outubro de 2026

- **App reorganizado por pergunta, não por fonte de dados.** Cinco páginas com título grande e uma linha de propósito: **Hoje** (próximo passo, anéis do dia, lista "Para hoje" na ordem de um dia e sinais de saúde/GitHub), **Corpo** (saúde importada, check-in, treino, alimentação e água, cuidados), **Foco** (cronômetro e blocos, curso em andamento, atividade do GitHub), **Evolução** (constância de 13 semanas, semana, leitura do dia e linha do tempo) e **Coleção**. Antes, Hoje empilhava sete cartões, "Evoluir" e "Conhecimento" repetiam conteúdo e o heatmap ocupava a primeira tela. A barra inferior tem Hoje, Corpo, +, Foco e Evolução; Coleção e Fontes continuam a um toque (rodapé e cabeçalho de cada página). Os endereços `#corpo`, `#foco`, `#evolucao` e `#colecao` funcionam como links; `#evoluir` e `#conhecimento` antigos levam a Foco.
- **Backup completo e versionado.** Além do espaço pessoal, o arquivo leva o armário de skincare (cadastro, todos os dias de histórico, motivos) e as fotos, mais o perfil GitHub conectado. A restauração substitui espaço e skincare em uma única transação IndexedDB (tudo ou nada), lista antes o que será substituído e oferece exportar os dados atuais primeiro. Backups antigos continuam sendo aceitos; arquivos adulterados, com fotos inconsistentes ou de versão desconhecida são recusados sem alterar nada.
- **Rascunhos protegidos.** Fechar um painel por botão, Escape, fundo ou gesto com informação digitada pergunta antes de descartar; o cadastro de produto sobrevive à troca de aba; campos de metas deixam de voltar a 0 ao serem apagados.
- **Hoje com ação na primeira tela.** Cartão "Próximo passo" com o botão principal e atalhos (+250 ml, refeição, foco, skincare).
- **Check-in com leituras importadas.** Sono, peso e passos do arquivo do Apple Saúde são oferecidos como sugestão (origem e data visíveis); nada é salvo sem confirmação e leituras antigas ou parciais não são oferecidas.
- **Skincare mais rápido.** "Marcar N pendentes como usados" (preserva não usos e motivos), destaque do próximo produto, confirmação de remoção junto à foto, fotos de até 25 MB (reduzidas para 1600 px antes de salvar) e rótulos de frascos em duas linhas.
- **Macros decimais.** Os campos aceitavam só gramas inteiras; agora aceitam décimos, com totais exatos a 0,1 g.
- **Legibilidade.** Mais da metade do texto de Hoje renderizava abaixo de 11 px (mínimo de 6 px, inclusive a procedência "prévia ilustrativa"). Piso de 11 px em todo o CSS.
- **Correções.** Painéis móveis não se expandem mais ao focar caixas de seleção (o controle fugia do toque); textos que afirmavam "GitHub não conectado" e "Garmin simulada" foram removidos junto com as telas inalcançáveis que os continham; `noUnusedLocals` ativado; publicação no Pages passa a rodar tipos e testes de domínio antes de publicar.

## 0.4.0 · 23 de outubro de 2026

- Novo panorama “Hoje” e shell móvel com hierarquia de saúde, contexto, atividade técnica, foco e ações frequentes.
- Central de fontes que distingue conexão pública, importação pontual, prévia e dados ausentes.
- GitHub público real por usuário, com atualização automática limitada, cache local, cobertura explícita e métricas que não confundem pushes, commits e deploys.
- Importador local de export.xml do Apple Saúde em Web Worker: oito métricas opcionais, até 14 dias, limite de 12 MiB e agregação com uma fonte por métrica/dia.
- Séries com lacunas preservadas, origem/data das leituras e contexto de sono/FC em repouso somente quando há base suficiente.
- Cronômetro de foco real com pausa, retomada, persistência entre recargas e conclusão atômica com o registro do bloco.
- Pesquisa de integrações e benchmark com distinção entre evidência consultada, bloqueios de acesso e propostas futuras.
- README e direção de produto atualizados para o fluxo receber → contextualizar → agir, com limites de backups e integrações explícitos.

## 0.3.1 · 23 de outubro de 2026

- Publicação do site em GitHub Pages após habilitação do serviço.
- Correção de ações pendentes que atravessavam a meia-noite: a data original é preservada antes de renovar os registros diários.
- Conflitos com outra aba que já arquivou o dia preservam os dois estados e pedem escolha explícita de backup, sem misturar métricas.
- Metadado de versão para identificar o artefato publicado e regressões de domínio/browser para retry entre dias.
- Direção de produto consolidada para cursos multiplataforma, hábitos livres, Apple Saúde e agentes futuros.

## 0.3.0 · 22 de outubro de 2026

- Persistência IndexedDB atômica entre abas, com migração do localStorage somente após commit confirmado.
- Fila de ações com identidade estável para retomar gravações abortadas sem perder remoções ou duplicar registros.
- Backups com limite central de tamanho, IDs únicos, referências válidas e totais coerentes.
- Refeições individuais removíveis, correção confirmada de totais e hidratação com acesso mais rápido.
- Distância decimal na corrida, séries com alvo explícito e insights antigos acessíveis/removíveis.
- Hidratação determinística entre datas e fusos, com controles indisponíveis até carregar os registros.
- Relógios isolados, pausados em segundo plano, e fallback offline após três segundos de rede travada.
- Cache canônico de assets, isolamento entre caminhos e headers no modo com servidor.
- Tailwind 4.3.3, remoção de dependências vulneráveis de desenvolvimento e revisão de acessibilidade/estados vazios.
- Testes adversariais, concorrência, migração, falhas de gravação e documentação de segurança/performance.

## 0.2.0 · 22 de outubro de 2026

- Check-in de bem-estar com energia, humor, estresse, sono e medidas opcionais.
- Blocos concluídos de foco com categoria, tempo e resultado.
- Metas pessoais e panorama de sete dias com preservação dos resumos diários.
- Espaço pessoal sem registros fictícios, distinto da demonstração.
- Restauração validada de backups, migração de registros antigos e recuperação de dados incompatíveis.
- Revisão de layout mobile, estados de treino e curso, checklist, rodapé, fontes e alvos de toque.
- Remoção confirmada de itens da wishlist.
- Exportação estática com caminho de Pages, cache offline isolado e verificações automatizadas de publicação.
- Documentação de produto, relatório de UX, imagens reais da interface e workflows de qualidade e Pages.

## 0.1.0 · 22 de outubro de 2026

- Shell Next.js/React com visual OLED e módulos de corpo, rotina, nutrição, engenharia, conhecimento e wishlist.
- Dados demonstrativos identificados, registros locais, painéis com mola e PWA offline.
