# Motor de recomendação

O Parfumania recomenda perfumes **da sua coleção** com um motor baseado em regras
(sem IA generativa). Código: `src/services/recommendations/`.

> As pontuações são heurísticas pessoais construídas a partir das informações que
> **você** cadastrou e dos acordes/notas do perfume. Não são avaliações científicas
> sobre as fragrâncias.

## Critérios e pesos padrão

| Critério | Peso padrão | O que compara |
|---|---:|---|
| Clima | 30 | Sensação térmica, umidade e chuva × climas marcados, perfil olfativo (acordes/notas) e força do perfume |
| Ocasião | 25 | Ocasião escolhida × ocasiões marcadas (com crédito para ocasiões parecidas) e projeção adequada à ocasião |
| Ambiente | 20 | Ambiente (fechado/aberto/ambos) × projeção (ou intensidade) e fixação |
| Período | 10 | Período do dia × períodos marcados e perfil olfativo |
| Preferência pessoal | 15 | Famílias favoritas/evitadas, avaliação pessoal, avaliações após uso (inclusive em situações parecidas), intensidade desejada, favoritos, família pedida para hoje |

Os pesos ficam em `src/data/defaults.ts` (`DEFAULT_WEIGHTS`) e podem ser alterados
em **Configurações → Motor de recomendação**. Se a soma não for 100, os pesos são
reescalados proporcionalmente (`normalizeWeights`).

## Como a pontuação é calculada

Cada critério devolve um de três estados:

- **Avaliado** — produz uma razão entre 0 e 1 (pontos = razão × peso) e uma
  **certeza**: 1 quando se baseia no que você marcou no perfume; 0,5–0,8 quando
  vem apenas de heurísticas (acordes, projeção).
- **Sem dados** (`unknown`) — falta informação **no perfume**. Não soma pontos e
  **reduz a confiança**.
- **Não considerado** (`not_applicable`) — falta informação **no contexto**
  (ex.: você não escolheu ocasião, ou não há dados de clima). Fica fora do cálculo.

Fórmulas:

```
pontuação base = (pontos obtidos / peso dos critérios avaliados) × 100
pontuação      = pontuação base + ajuste de rodízio   (limitada a 0–100)
confiança      = Σ(peso × certeza dos avaliados) / peso dos critérios aplicáveis
ordenação      = pontuação × (0,5 + 0,5 × confiança) × (0,97 se for decant)
```

Confiança: alta ≥ 75%, média ≥ 45%, baixa abaixo disso. Se nenhum perfume tiver
confiança mínima (34%), a tela explica a limitação e oferece escolha manual.

### Por que as notas não ficam todas em 100

- **Especificidade**: marcar um perfume para *todas* as ocasiões, períodos ou
  temperaturas é válido (ele é versátil), mas vale menos que uma indicação feita
  a dedo: até −24% conforme a proporção de opções marcadas.
- **Aderência gradual**: 24 °C não é "frio nem quente" de forma binária; a nota
  cai suavemente conforme a temperatura se afasta da faixa marcada.
- **Opinião neutra**: na preferência pessoal, um único sinal (ex.: "favorito")
  é combinado com um peso neutro de 0,6 a 50%, para não levar o critério a 100%.

## Perfil olfativo (acordes e notas)

`profile.ts` calcula um eixo **fresco (−1) ↔ quente (+1)** a partir dos acordes
(peso maior, os dominantes primeiro) e das notas cadastradas (base > coração >
saída). Ex.: cítrico, aquático, verde, bergamota → fresco; âmbar, baunilha,
resinas, oud, fava tonka → quente. Precisa de pelo menos 2 termos reconhecidos;
caso contrário, nada é presumido. **A família olfativa sozinha nunca é usada.**

Perfil ideal pela sensação térmica: `(22 − T) / 12`, limitado a −1…+1
(34 °C → fresco; 10 °C → quente). À noite, perfis mais quentes ganham um pouco.

## Regras de cada critério

**Clima** — faixas configuráveis (padrão: quente ≥ 26 °C, frio < 16 °C), usando a
sensação térmica quando disponível. Partes combinadas:
climas marcados (55%, gradual com especificidade), perfil olfativo (30%; 60% se
não houver climas marcados, com certeza 0,6), força × temperatura (projeção 4–5
no calor perde pontos; projeção 1 no frio também), umidade e chuva quando o
perfume tem a marcação correspondente.

**Ocasião** — marcada = 1 (com especificidade); ocasião parecida = 0,45
(ex.: encontro ↔ festa, trabalho ↔ dia a dia/formal); outras = 0. Combinada (25%)
com a adequação da projeção à ocasião (alvos 1–5: academia 1,5; trabalho 2;
festa 4,5…). Sem ocasiões marcadas, só a projeção conta, com certeza 0,5.

**Ambiente** — tabela por projeção (1 a 5); ao ar livre, a fixação pesa 15%:

| Projeção | Fechado | Aberto | Ambos |
|---|---:|---:|---:|
| 1 Íntima | 1,00 | 0,40 | 0,45 |
| 2 Próxima | 1,00 | 0,60 | 0,75 |
| 3 Moderada | 0,75 | 0,85 | 1,00 |
| 4 Ampla | 0,40 | 1,00 | 0,75 |
| 5 Enorme | 0,20 | 1,00 | 0,45 |

**Período** — marcado = 1 (com especificidade); adjacente = 0,5; demais = 0.
Combinado (25%) com o perfil olfativo ideal do período (manhã fresco → noite quente).

**Preferência pessoal** — média ponderada: família pedida hoje (peso 2),
família evitada (1,5), avaliação pessoal (1,5), favorito (1), família favorita
(0,8), intensidade desejada (1), média das avaliações após uso (até 2) e
**avaliações em situação parecida** — mesma ocasião ou temperatura a até 4 °C —
(até 2,5). Mais a opinião neutra descrita acima.

## Rodízio (ajuste)

Ligado por padrão; desligue em **Configurações → Motor de recomendação** se você
prefere um perfume assinatura.

| Situação | Ajuste |
|---|---:|
| Já usado hoje | −12 |
| Usado ontem | −7 |
| 3+ usos nos últimos 7 dias | −5 |
| Usado anteontem | −3 |
| Sem uso há 21+ dias | +4 |
| Nunca usado (quando você já tem 5+ registros) | +3 |

## Elegibilidade

Somente perfumes com status **Na coleção** ou **Amostra / decant** e volume restante
diferente de 0 ml são considerados. Uma recomendação **não** é registrada como uso:
o uso só conta depois que você confirma no diálogo "Registrar uso".
