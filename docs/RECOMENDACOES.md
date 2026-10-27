# Motor de recomendação

O Parfumania recomenda perfumes **da sua coleção** com um motor baseado em regras
(sem IA generativa). Código: `src/services/recommendations/`.

> As pontuações são heurísticas pessoais construídas a partir das informações que
> **você** cadastrou. Não são avaliações científicas sobre as fragrâncias.

## Critérios e pesos padrão

| Critério | Peso padrão | O que compara |
|---|---:|---|
| Clima | 30 | Temperatura, umidade e chance de chuva × climas marcados no perfume |
| Ocasião | 25 | Ocasião escolhida × ocasiões marcadas no perfume |
| Ambiente | 20 | Ambiente (fechado/aberto/ambos) × projeção percebida (ou intensidade, se não houver projeção) |
| Período | 10 | Período do dia × períodos marcados no perfume |
| Preferência pessoal | 15 | Famílias favoritas/evitadas, avaliação pessoal, média das avaliações após uso, intensidade desejada, favoritos, família pedida para hoje |

Os pesos ficam em `src/data/defaults.ts` (`DEFAULT_WEIGHTS`) e podem ser alterados
em **Configurações → Motor de recomendação**. Se a soma não for 100, os pesos são
reescalados proporcionalmente (`normalizeWeights`).

## Como a pontuação é calculada

Cada critério devolve um de três estados:

- **Avaliado** — produz uma razão entre 0 e 1; pontos = razão × peso.
- **Sem dados** (`unknown`) — falta informação **no perfume** (ex.: nenhum clima
  marcado). Não soma pontos e **reduz a confiança**.
- **Não considerado** (`not_applicable`) — falta informação **no contexto**
  (ex.: você não escolheu ocasião, ou não há dados de clima). Fica fora do cálculo.

Fórmulas:

```
pontuação  = (pontos obtidos / peso dos critérios avaliados) × 100
confiança  = peso dos critérios avaliados / peso dos critérios aplicáveis
ordenação  = pontuação × (0,5 + 0,5 × confiança) × (0,97 se for decant)
```

Confiança: alta ≥ 75%, média ≥ 45%, baixa abaixo disso. Se nenhum perfume tiver
confiança mínima (34%), a tela explica a limitação e oferece escolha manual.

## Regras de cada critério

**Clima** — faixa de temperatura configurável (padrão: quente ≥ 26 °C, frio < 16 °C).
Faixa marcada no perfume = 1; faixa vizinha (envolvendo "ameno") = 0,55; oposta
(quente × frio) = 0,1. Umidade ≥ 70% ou ≤ 35% e chuva ≥ 50% entram como ajustes
apenas quando o perfume tem a marcação correspondente.
**A família olfativa nunca é usada para julgar o clima.**

**Ocasião** — marcada = 1; não marcada = 0.

**Ambiente** — tabela por projeção (1 a 5):

| Projeção | Fechado | Aberto | Ambos |
|---|---:|---:|---:|
| 1 Íntima | 1,00 | 0,40 | 0,45 |
| 2 Próxima | 1,00 | 0,60 | 0,75 |
| 3 Moderada | 0,75 | 0,85 | 1,00 |
| 4 Ampla | 0,40 | 1,00 | 0,75 |
| 5 Enorme | 0,20 | 1,00 | 0,45 |

**Período** — marcado = 1; período adjacente = 0,5; demais = 0.

**Preferência pessoal** — média dos sinais disponíveis: família pedida hoje
(1 / 0,2), família favorita (1), família evitada (0), favorito (1), avaliação
pessoal ((n−1)/4), média das avaliações após uso ((média−1)/4) e proximidade da
intensidade desejada (alvos: discreta 1,5; moderada 3; marcante 4,5).

## Elegibilidade

Somente perfumes com status **Na coleção** ou **Amostra / decant** e volume restante
diferente de 0 ml são considerados. Uma recomendação **não** é registrada como uso:
o uso só conta depois que você confirma no diálogo "Registrar uso".
