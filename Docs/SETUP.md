# Configuração e build

## Requisitos

- **Unity 6 LTS (6000.0.x)** com **Android Build Support** (+ OpenJDK + Android SDK & NDK Tools) instalados pelo Unity Hub.
  O `ProjectVersion.txt` aponta para 6000.0.58f2; qualquer patch 6000.0.x serve (o Hub oferece atualizar).
- Opcional: **.NET 8 SDK** para rodar os testes da simulação fora da Unity.

## Primeira abertura

Ao abrir o projeto, `ProjectSetup` (Editor) roda automaticamente uma única vez e:

1. Cria `Assets/_Project/Settings/URP_Low|Medium|High.asset` (+ renderers) e define o Medium como pipeline padrão.
2. Configura os níveis de qualidade **Low / Medium / High** apontando para esses assets.
3. Cria o material-modelo `M_LitTemplate.mat` (URP Simple Lit) e o liga ao `GameDatabase`.
4. Coloca `Scenes/Main.unity` como primeira cena da build.
5. Ajusta Player Settings do Android: nome, `com.empiretycoon.game`, IL2CPP, ARM64, API mínima 24, paisagem, espaço de cor Linear.

Repetir a qualquer momento: **Empire Tycoon → Configurar Projeto (URP, Qualidade, Android)**.
Se a cena sumir/corromper: **Empire Tycoon → Recriar Cena Principal**.

**Input System:** se a Unity perguntar se deseja ativar os novos backends de entrada, responda **Sim**
(o Editor reinicia). O jogo funciona com o Input System novo, com o legado ou com ambos.

## Rodar

Abra `Assets/_Project/Scenes/Main.unity` → **Play**. Para testar toque no Editor, use o *Device Simulator*
(Window → General → Device Simulator).

## Saves

Ficam em `Application.persistentDataPath/saves/` (`autosave.etsave`, `manual.etsave` e backups `.bak1/.bak2`).
No Windows: `%USERPROFILE%/AppData/LocalLow/Empire Tycoon Studio/Empire Tycoon/saves`. Para começar do zero
nos testes, apague essa pasta.

## Build

Menu **Empire Tycoon → Build**:

- **Android APK (desenvolvimento)** → `Builds/Android/EmpireTycoon-dev.apk` (instale com `adb install -r`).
- **Android AAB (Google Play)** → requer keystore (abaixo).
- **Desktop (plataforma do Editor)** → para testes rápidos no PC.

Linha de comando (CI):

```
Unity -batchmode -quit -projectPath . -executeMethod EmpireTycoon.EditorTools.BuildScript.BuildAndroidDevelopment -logFile build.log
```

## O que você precisa configurar manualmente

| Item | Quando | Onde |
|---|---|---|
| Identificador do app definitivo (se não for `com.empiretycoon.game`) | antes da 1ª publicação | Project Settings → Player → Android → Package Name |
| Keystore de assinatura (release) | antes de gerar AAB | Project Settings → Player → Android → Publishing Settings. **Não versione o keystore.** |
| Conta Google Play Console | Fase 10 | play.google.com/console |
| Firebase (`google-services.json`) | Fase 8+ (online opcional) | será documentado na fase; arquivo já está no `.gitignore` |
| AdMob App ID / Ad Unit IDs | Fase 8 | será documentado na fase (modo de teste disponível sem conta) |
| Produtos IAP (diamantes, VIP...) | Fase 8 | Google Play Console → Monetização |

## Problemas comuns

- **Tela rosa/magenta:** o URP não foi configurado. Rode *Empire Tycoon → Configurar Projeto*.
- **"GameDatabase não encontrado":** o arquivo `Assets/_Project/Resources/GameDatabase.asset` foi movido/renomeado.
- **Versões de pacote:** ao abrir com outro patch do Unity 6, o Package Manager pode atualizar URP/Input System — aceite.
