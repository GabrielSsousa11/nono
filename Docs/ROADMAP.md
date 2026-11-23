# Roadmap — Empire Tycoon

Legenda: ✅ concluído · 🟡 parcial · ⬜ não iniciado

## FASE 1 — Fundação técnica + primeiro protótipo ✅ (aguardando sua validação no Unity)

| Item da primeira missão | Status | Onde |
|---|---|---|
| Analisar a pasta do projeto | ✅ | repositório estava vazio; projeto criado do zero |
| Verificar Unity instalado | ⚠️ | o ambiente de desenvolvimento (nuvem/Linux) **não tem Unity**. Ver "Verificação" abaixo |
| Planejar estrutura técnica | ✅ | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Documentação inicial | ✅ | README, ARCHITECTURE, SETUP, ART_PIPELINE, ROADMAP |
| Configurar arquitetura | ✅ | 4 assemblies, simulação sem Unity, EventBus, comandos validados |
| Primeira cena | ✅ | `Scenes/Main.unity` + `GameBootstrap` |
| Câmera 3D | ✅ | isométrica, pan/zoom/rotação por toque, mouse e teclado, limites, suavização |
| Cidade demonstrativa | ✅ | "Nova Aurora": 7×7 quarteirões, 159 terrenos, 5 zonas, ruas com faixas, praças, prédios |
| Sistema de construção | ✅ | comprar/vender terreno, construir (5 tipos), obra com tempo, melhorias (níveis), demolição |
| Primeira versão executável | 🟡 | menus de build prontos (APK/AAB/Desktop); a build em si precisa ser gerada no seu Unity |

Também entregue na Fase 1 (base para as próximas):

- Relógio de simulação com velocidades (pausa/1x/3x/8x) e calendário.
- Finanças: caixa em centavos, livro-razão, manutenção diária, imposto predial, imposto de transmissão.
- Presets gráficos Baixo/Médio/Alto (URP) com detecção por hardware e meta 30/60 FPS.
- HUD (caixa, custos fixos/dia, resultado de ontem, data, velocidade, qualidade), painel de terreno,
  menu de construção, diálogos de confirmação, notificações, área segura, botão voltar do Android.
- 52 testes automatizados na entrega da Fase 1 (simulação + validação dos dados reais + relatório de balanceamento).

### Verificação realizada

- `dotnet test Tools/SimulationTests` → aprovados (mesmos arquivos de teste do Test Runner da Unity).
- A camada Unity foi compilada contra *stubs* da API (somente assinaturas) nos dois modos de entrada,
  sem erros — isso pega erros de C#, mas **não substitui** a compilação no Editor.
- Os modelos 3D procedurais e o layout da cidade foram exportados do mesmo código C# e renderizados
  (WebGL) para conferência visual.
- **Pendente (requer Unity):** abrir o projeto, conferir console sem erros, Play na cena Main, build Android
  e medição de FPS em aparelho intermediário.

### Limitações conhecidas da Fase 1

- Estabelecimentos ainda não produzem nem vendem: só têm custos. Receita chega na Fase 3 — o painel informa isso.
- ~~Sem salvamento~~ → resolvido na Fase 2.
- Modelos 3D procedurais provisórios (ver [ART_PIPELINE.md](ART_PIPELINE.md)); sem áudio; fonte padrão da Unity.

## FASE 2 — Construção da cidade ✅ (desenvolvida sem Unity; validar junto com a Fase 1)

| Item | Status | Onde |
|---|---|---|
| Salvamento automático | ✅ | a cada 2 min reais, ao minimizar o app (Android) e ao sair — `GameBootstrap` |
| Salvamento manual e carregamento | ✅ | menu de pausa: Salvar / Carregar jogo salvo / Carregar automático |
| Versionamento dos dados | ✅ | cabeçalho com versão do formato; saves de versão mais nova são recusados com mensagem clara |
| Proteção contra corrupção | ✅ | CRC32 + escrita atômica (`.tmp` validado antes de substituir) |
| Recuperação por backup | ✅ | 2 backups rotativos; save danificado → carrega o backup mais recente válido |
| Migração de versões antigas | ✅ | cadeia de `SaveMigration` (testada com formatos simulados v1→v3) |
| Nuvem como opcional | ✅ (arquitetura) | `SaveStorage` é local; a nuvem entrará como camada extra, nunca como requisito |
| Cidade viva | ✅ | `CityGrowth`: moradores e empresas locais ocupam terrenos vagos (obra de 48 h visível), guiados por moradores × empregos; reserva mínima de 35% dos terrenos à venda por zona |
| População e empregos | ✅ | `CityStats`, exibidos no HUD (base da demanda da Fase 3) |
| Valorização por bairro | ✅ | ocupação da vizinhança + praças próximas, até +18%, recalculada à meia-noite; invariante anti-exploit validada na configuração |
| Tela inicial e menu de pausa | ✅ | Continuar (save mais recente), Novo jogo, Gráficos; Retomar/Salvar/Carregar/Novo/Sair; botão voltar abre o menu |
| Object pooling | ✅ | `RendererPool` reaproveita todos os objetos de malha da cidade |
| LOD | ✅ | prédios de andares (escritórios, apartamentos, torres) com versão simplificada a distância |
| Melhorias com visual distinto | ✅ | cada nível gera modelo diferente (já na Fase 1) |

**Verificação:** 75 testes aprovados com `dotnet test`, incluindo: salvar → carregar → continuar produz
exatamente o mesmo resultado que jogar sem parar (comparação byte a byte), corrupção/truncamento,
recuperação por backup, migração, saves de versão futura, crescimento determinístico, nenhuma zona
fica sem terrenos e valorização nunca permite lucro com revenda. A camada Unity compila contra stubs da
API no perfil .NET Standard 2.1 (o da Unity), nos dois modos de entrada. Pendente: rodar no Editor.

**Não incluído (decisão):** carregamento assíncrono com tela de loading — a cidade atual monta em um frame;
será necessário quando houver várias cidades (Fase 7).

## FASE 3 — Economia e produção ⬜
Mercadorias (ScriptableObjects), cadeias produtivas, estoques, preços por oferta/demanda com elasticidade,
inflação, energia, capacidade industrial, vendas no varejo, ferramenta de balanceamento (simulação acelerada + relatórios).

## FASE 4 — Logística e funcionários ⬜
Transporte entre edifícios, veículos (pooling), armazéns, contratos; contratação, salários, produtividade.

## FASE 5 — Concorrentes (IA) ⬜
Empresas de IA usando os mesmos comandos da `GameSession` (sem trapaça): compram terrenos, constroem,
precificam, expandem, investem, compram concorrentes e podem falir.

## FASE 6 — Pesquisa e progressão ⬜
Árvore tecnológica, desbloqueios, metas, conquistas (Google Play Games).

## FASE 7 — Mapa e expansão ⬜
Múltiplas cidades, regiões, países, portos, aeroportos, rotas e mercados estrangeiros.

## FASE 8 — Monetização ⬜
Camada `IMonetizationService` independente; AdMob (recompensado com confirmação de conclusão, intersticial
limitado e nunca em momento crítico); Unity IAP (diamantes, dinheiro, pacotes, oferta inicial, Empire VIP),
verificação/restauração de compras, idempotência de recompensas, modo de testes, tratamento offline.

## FASE 9 — Interface, áudio e polimento ⬜
TextMeshPro, localização, ícones, animações de UI, áudio, efeitos ambientais, modelos finais do Blender.

## FASE 10 — Testes e publicação ⬜
Perfis de desempenho em aparelhos reais, testes de regressão, Play Console, política de privacidade, lançamento.
