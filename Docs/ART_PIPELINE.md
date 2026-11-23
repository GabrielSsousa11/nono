# Pipeline de arte (Blender → Unity)

Na Fase 1 os edifícios usam **modelos procedurais low-poly** (`BuildingModelFactory`): fachadas,
janelas, toldos, telhados, chaminés, andaimes e guindastes gerados por código. Eles são o conteúdo
provisório — o jogo final usará modelos próprios feitos no Blender (ou licenciados corretamente).

## Como substituir um modelo procedural

1. Exporte o modelo do Blender como **FBX** e coloque em `Assets/_Project/Art/Buildings/<id>/`.
2. Crie um prefab a partir dele.
3. No asset do edifício (`Assets/_Project/Data/Buildings/Building_*.asset`), arraste o prefab para **Model Prefab**.

Nenhum código precisa mudar: `CityView` instancia o prefab no lugar do modelo procedural.

## Convenções obrigatórias

| Regra | Valor |
|---|---|
| Unidade | 1 unidade = 1 metro |
| Pivô | centro do terreno, no nível do chão (y = 0) |
| Fachada principal | voltada para **−Z** (o jogo gira o modelo para a rua) |
| Área útil | terreno comercial: 10 × 10 m · industrial: 22 × 10 m (lote menos 1 m de margem) |
| Polígonos (LOD0) | pequeno comércio ≤ 3 mil tris · torre/fábrica ≤ 8 mil tris |
| LODs | LOD0/LOD1 (50%)/LOD2 (15%) via LOD Group para prédios altos |
| Materiais | URP Simple Lit ou Lit; atlas de cores 256×256 compartilhado sempre que possível |
| Texturas | ASTC (Android), máx. 1024² por edifício |
| Níveis | um prefab por nível (`modelPrefab` atual vale para todos; níveis por prefab entram na Fase 9) |

Exportação FBX no Blender: *Apply Transform*, *Up: Y*, escala 1.0, apenas malhas selecionadas. Depois de importar,
confira na Scene view da Unity que a fachada aponta para −Z (eixo Z azul apontando para trás do prédio); se não,
ajuste o eixo *Forward* da exportação.
