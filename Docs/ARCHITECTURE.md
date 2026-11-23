# Arquitetura — Empire Tycoon

## Princípios

1. **Simulação independente da renderização.** Toda regra de jogo vive em `EmpireTycoon.Simulation`
   (asmdef com `noEngineReferences: true`): não pode usar a Unity. Isso permite testes rápidos,
   ferramentas de balanceamento, simulação acelerada e, no futuro, validação em servidor.
2. **Comandos validados.** O estado só muda por comandos da `GameSession` (`BuyLot`, `Construct`, `Upgrade`...).
   Cada comando tem um `Can*` correspondente que retorna o mesmo `CommandResult` — a UI usa o `Can*`
   para desabilitar botões e mostrar o motivo, então a regra nunca é duplicada na interface.
3. **Eventos de domínio.** A simulação publica eventos (`LotOwnershipChanged`, `BuildingStateChanged`...)
   em um `EventBus` tipado. A camada visual e a UI apenas assinam; a simulação não conhece quem escuta.
4. **Dados em ScriptableObjects, regras em C# puro.** `BuildingDefinitionAsset` (Inspector) é convertido
   em `BuildingDefinition` (imutável, validado) quando a partida começa.
5. **Composition root único.** `GameBootstrap` cria e conecta todos os sistemas. Não há singletons
   globais nem `FindObjectOfType`; dependências são passadas por construtor/`Initialize`.

## Assemblies

| Assembly | Depende de | Conteúdo |
|---|---|---|
| `EmpireTycoon.Simulation` | — | Core, Economy, WorldMap (incl. crescimento), Buildings, Session, SaveSystem |
| `EmpireTycoon.Runtime` | Simulation, Input System, uGUI | Bootstrap, Data (SOs), CameraSystem, Input, Rendering, Interaction, UI, Quality, Persistence |
| `EmpireTycoon.Editor` | Runtime, Simulation, URP | Configuração automática do projeto, builds |
| `EmpireTycoon.Tests.EditMode` | Simulation, NUnit | Testes da simulação |

Módulos planejados (fases seguintes) seguem o mesmo padrão: lógica em `Simulation/<Módulo>`,
apresentação em `Runtime/<Módulo>`. Exemplos: `Production`, `Logistics`, `Employees`, `AI`, `Research`,
`Events`, `Progression`. `Monetization` e `Audio` ficam só na camada Runtime, atrás de
interfaces, para que o jogo funcione sem SDKs externos (modo de testes).

## Simulação

- **Tempo:** `SimulationClock` — 1 tick = 1 hora de jogo; 0,5 s reais por tick na velocidade 1x
  (velocidades 0/1x/3x/8x). A economia avança em ticks discretos, independente do FPS, com limite de
  ticks por frame (o jogo desacelera em vez de travar em aparelhos lentos ou ao voltar do segundo plano).
- **Dinheiro:** `Money` é um inteiro de centavos (`long`) com aritmética `checked`. Sem `float` em
  valores monetários → sem dinheiro surgindo de arredondamento; overflow vira exceção em vez de wrap.
- **Caixa auditável:** `Company` só altera o caixa via `TryDebit` (gasto voluntário, exige saldo),
  `Charge` (obrigação: manutenção, impostos — pode negativar) ou `Credit`. Tudo vai para o `Ledger`
  (memória limitada). Teste garante: *caixa == soma do livro-razão*.
- **Anti-exploit:** revenda de terreno (80%) < compra (100% + 3% de imposto); demolição devolve 25%.
  Teste percorre todos os terrenos garantindo que comprar e vender sempre dá prejuízo.
- **Cidade:** `CityGenerator` determinístico (xorshift próprio, não `System.Random`) — mesma semente,
  mesma cidade em qualquer plataforma. Grade de quarteirões, zoneamento por anéis (centro → comercial →
  residencial) e setor industrial com lotes maiores. Preparada para várias cidades (`CityMap.Id`).
- **Custos diários (meia-noite):** manutenção dos edifícios em operação/reforma e imposto predial pro rata.

## Salvamento (Fase 2)

- **Snapshot:** `GameSession.CreateSnapshot()` produz um `GameSnapshot` (DTO puro). A geometria da cidade
  não é salva: é regenerada pela semente salva; só o estado variável vai para o arquivo (donos, estruturas,
  obras, valorização, edifícios, empresas e livro-razão, RNG do crescimento). `GameSession.Restore()` faz o caminho inverso.
- **Economia vem da configuração atual**, não do save: rebalancear o jogo não invalida saves.
- **Formato:** `"ETSV" | versão | tamanho | CRC32 | GZip(BinaryWriter)`. Binário próprio (sem dependências,
  compacto, determinístico). Leitura de campos novos condicionada à versão; `SaveMigration` para mudanças semânticas.
- **Disco:** `SaveStorage` grava em `.tmp`, decodifica para validar, rotaciona backups (`.bak1`, `.bak2`) e só então
  substitui. No carregamento, tenta o principal e depois os backups. Um save de versão futura nunca é "corrigido" com backup antigo.
- **Robustez de conteúdo:** edifício cujo tipo foi removido do jogo é descartado com devolução integral do
  investimento (categoria `Compensation`) e aviso; dono inexistente volta para a prefeitura.
- **Determinismo garantido por teste:** salvar/carregar no meio de uma partida não altera nenhum byte do resultado.
- Na Unity, `SaveController` usa `Application.persistentDataPath/saves`, slots `autosave` e `manual`.

## Cidade viva (Fase 2)

- `CityGrowth` (diário, RNG próprio salvo no save): com chance configurável, um terreno vago recebe um empreendimento
  particular (48 h de obra). Se há mais empregos que moradores, prefere zona residencial; senão, comercial/industrial.
  Mantém no mínimo 35% dos terrenos de cada zona à venda e nunca toca terrenos de empresas.
- `CityStats`: moradores e empregos estimados por estrutura (base da demanda na Fase 3).
- `LandMarket.RecomputeNeighborhood`: valorização por ocupação da vizinhança e praças, com teto; recalculada só à meia-noite
  (preços estáveis durante o dia, simulação barata). `EconomyConfig.Validate` garante `revenda × (1 + teto) < 1 + imposto`.

## Apresentação (Unity)

- **CityView** observa eventos e reconstrói apenas o terreno afetado. Edifícios em obra crescem
  suavemente (interpolando entre ticks) com andaime e guindaste animado.
- **Modelos procedurais** (`BuildingModelFactory` + `MeshBuilder`): malhas low-poly com fachadas,
  janelas, toldos, telhados e chaminés, geradas e cacheadas por estilo/nível/tamanho. São o conteúdo
  provisório até os modelos do Blender — `modelPrefab` no asset substitui sem mudar código
  ([ART_PIPELINE.md](ART_PIPELINE.md)). Não são primitivas da Unity.
- **Materiais:** `MaterialLibrary` cria um material por cor a partir de um material-modelo URP Simple Lit
  (referenciado no `GameDatabase` para garantir que o shader entre na build) e os reaproveita (SRP Batcher).
- **Pooling e LOD:** todos os objetos de malha da cidade vêm do `RendererPool` (obras, melhorias e crescimento
  trocam modelos sem alocar). Prédios de andares acima de 9 m ganham `LODGroup` com um volume simplificado.
- **Fluxo de jogo:** `GameBootstrap` implementa `IGameFlow` (novo jogo, carregar, salvar, sair). Carregar recria a cidade 3D
  e a UI para a nova sessão; a tela inicial mostra a cidade de uma partida nova ao fundo, pausada.
- **Picking** sem física: raio contra volumes dos edifícios e depois contra o plano do chão.
- **Entrada:** `PointerGestureInput` unifica toque (arrastar, pinça, giro), mouse e teclado, para o Input
  System e para o Input Manager legado. Gestos iniciados sobre a UI são ignorados pelo mundo.
- **UI:** uGUI criada por código com tokens de tema (`UITheme`), cantos arredondados gerados em runtime,
  área segura (entalhes), escala por altura (paisagem). Textos em `UIStrings` (pt-BR) para localização futura.
- **Qualidade:** três URP Assets (Low/Medium/High: escala de render, MSAA, sombras) ligados aos níveis
  de qualidade; `QualityPresetManager` escolhe por hardware, define a meta de FPS (30/60) e lembra a escolha.

## Decisões registradas (ADR resumido)

| # | Decisão | Motivo |
|---|---|---|
| 1 | Simulação em assembly sem Unity | Testabilidade, determinismo, ferramentas de balanceamento |
| 2 | Dinheiro em centavos `long` | Exatidão e prevenção de exploits |
| 3 | RNG próprio (xorshift64*) | `System.Random` varia entre runtimes; saves e cidades reproduzíveis |
| 4 | Ticks discretos com teto por frame | Desempenho previsível em celulares intermediários |
| 5 | Cena mínima + bootstrap por código | Cena estável no Git, montagem explícita e revisável |
| 6 | UI por código (uGUI + fonte embutida) | Sem dependência de pacotes de fontes/TMP na Fase 1; migração para TextMeshPro planejada na Fase 9 |
| 7 | Modelos procedurais provisórios com troca por prefab | Protótipo visual digno sem bloquear na arte final |
| 8 | GUIDs determinísticos para assets escritos fora do Editor | Referências entre cena/assets revisáveis no Git (`Tools/generate_meta.py`) |
| 9 | Save binário próprio + CRC + backups | Sem dependências (Newtonsoft/JsonUtility), compacto, detecta corrupção, recupera sozinho |
| 10 | Cidade regenerada pela semente no load | Saves pequenos; layout sempre consistente com o código |
| 11 | Valorização recalculada só à meia-noite | Preços previsíveis para o jogador e determinismo do save |
