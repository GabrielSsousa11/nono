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
- 52 testes automatizados (simulação + validação dos dados reais + relatório de balanceamento).

### Verificação realizada

- `dotnet test Tools/SimulationTests` → **52/52 aprovados** (mesmos arquivos de teste do Test Runner da Unity).
- A camada Unity foi compilada contra *stubs* da API (somente assinaturas) nos dois modos de entrada,
  sem erros — isso pega erros de C#, mas **não substitui** a compilação no Editor.
- Os modelos 3D procedurais e o layout da cidade foram exportados do mesmo código C# e renderizados
  (WebGL) para conferência visual.
- **Pendente (requer Unity):** abrir o projeto, conferir console sem erros, Play na cena Main, build Android
  e medição de FPS em aparelho intermediário.

### Limitações conhecidas da Fase 1

- Estabelecimentos ainda não produzem nem vendem: só têm custos. Receita chega na Fase 3 — o painel informa isso.
- Sem salvamento ainda (planejado para a Fase 2): fechar o jogo reinicia a partida.
- Modelos 3D procedurais provisórios (ver [ART_PIPELINE.md](ART_PIPELINE.md)); sem áudio; fonte padrão da Unity.

## FASE 2 — Construção da cidade ⬜
Salvamento local (automático/manual, versionado, backup, migração), nível de prédio com modelos distintos,
ruas/terrenos com acesso validado, população e demanda por zona, pooling de objetos, LOD.

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
