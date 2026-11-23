# EMPIRE TYCOON

Jogo 3D de estratégia e gestão empresarial para Android (Unity 6 · C# · URP).
O jogador começa com uma pequena empresa e um terreno em uma cidade e cresce até um conglomerado internacional.

> **Status: Fases 1 e 2 concluídas (aguardando validação no Unity).**
> Abra o projeto, aperte Play: tela inicial sobre a cidade 3D → novo jogo ou continuar. Selecione terrenos,
> compre, venda, construa, melhore e demola estabelecimentos, com custos e impostos reais. A cidade cresce
> sozinha, bairros valorizam, e o jogo salva automaticamente (com backups e recuperação).
> Veja [Docs/ROADMAP.md](Docs/ROADMAP.md) para o que foi entregue e o que falta.

## Início rápido

1. Instale o **Unity 6 LTS (6000.0.x)** pelo Unity Hub, com o módulo **Android Build Support** (inclui SDK/NDK/OpenJDK).
2. Unity Hub → *Add project from disk* → selecione esta pasta.
3. Na primeira abertura o projeto se configura sozinho (URP, presets de qualidade, material-modelo, cena na build,
   Player Settings do Android). Para repetir: menu **Empire Tycoon → Configurar Projeto**.
4. Abra `Assets/_Project/Scenes/Main.unity` e aperte **Play**.

Detalhes, problemas comuns e build Android: [Docs/SETUP.md](Docs/SETUP.md).

## Controles

| Ação | Toque | Mouse/Teclado |
|---|---|---|
| Mover câmera | arrastar 1 dedo | arrastar botão esquerdo/meio · WASD/setas |
| Zoom | pinça | roda do mouse · `+`/`-` |
| Girar | girar 2 dedos | arrastar botão direito · `Q`/`E` |
| Selecionar terreno | tocar | clicar |
| Fechar/voltar · menu de pausa | botão voltar do Android | `Esc` |

## Testes

A simulação econômica é C# puro (sem Unity) e é testada de duas formas, com **os mesmos arquivos de teste**:

- Na Unity: *Window → General → Test Runner → EditMode → Run All*.
- Fora da Unity (CI ou terminal): `dotnet test Tools/SimulationTests` (requer .NET 8 SDK).
  Inclui validação dos dados reais do jogo (assets) e um relatório de balanceamento:
  `dotnet test Tools/SimulationTests --filter BalanceReport --logger "console;verbosity=detailed"`.

## Estrutura

```
Assets/_Project/
  Scripts/Simulation/   Núcleo do jogo em C# puro (economia, cidade, construção, saves). Sem dependência da Unity.
  Scripts/Runtime/      Camada Unity: bootstrap, câmera, entrada, renderização 3D, interface.
  Scripts/Editor/       Configuração automática do projeto e scripts de build.
  Tests/EditMode/       Testes NUnit da simulação.
  Data/                 ScriptableObjects (tipos de edifício).
  Resources/            GameDatabase (configuração da partida e catálogo).
  Scenes/Main.unity     Cena principal.
Docs/                   Arquitetura, roadmap, setup, pipeline de arte.
Tools/                  Testes fora da Unity e utilitários (geração de .meta).
```

Arquitetura e decisões técnicas: [Docs/ARCHITECTURE.md](Docs/ARCHITECTURE.md).
