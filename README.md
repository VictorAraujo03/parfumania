# Parfumania

Assistente pessoal de perfumaria: organize sua coleção, registre o que você usa,
receba recomendações explicadas conforme clima e ocasião, e acompanhe suas
estatísticas — tudo salvo localmente no navegador, sem login e sem backend.

## Requisitos

- Node.js **16.14+** (testado com 16.20). Node 18/20 também funcionam.
- npm 8+

## Comandos

```bash
npm install        # instalar dependências
npm run dev        # servidor de desenvolvimento em http://localhost:5173
npm test           # testes unitários (motor de recomendação e estatísticas)
npm run build      # checagem de tipos + build de produção em dist/
npm run preview    # servir o build localmente
```

## Variáveis de ambiente

Nenhuma é obrigatória. Copie `.env.example` para `.env.local` se quiser ajustar.

| Variável | Padrão | Uso |
|---|---|---|
| `VITE_BASE_PATH` | `/` | Caminho-base do build (ex.: `/parfumania/` no GitHub Pages) |
| `VITE_WEATHER_ENABLED` | `true` | `false` desliga a consulta meteorológica |
| `VITE_SUPABASE_URL` | — | URL do projeto Supabase. Com ela e a chave, o login fica obrigatório |
| `VITE_SUPABASE_ANON_KEY` | — | Chave **pública** (anon/publishable) do Supabase |

## Login e banco de dados (Supabase)

Com o Supabase configurado, o app exige login (e-mail e senha) e salva a coleção,
os registros, as ofertas, as configurações e as imagens na sua conta — disponíveis
em qualquer aparelho. Sem as variáveis acima, o app roda em modo local.

### 1. Criar o projeto
1. Crie uma conta em [supabase.com](https://supabase.com) e um projeto (plano gratuito).
2. Em **SQL Editor → New query**, cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql)
   e clique em **Run**. Isso cria as tabelas, as regras de acesso por usuário (RLS)
   e o bucket privado de imagens.
3. Em **Project Settings → API**, copie a **Project URL** e a chave **anon / publishable**.
   Nunca use a chave `service_role` no app.

### 2. Configurar o login
Em **Authentication → URL Configuration**:
- **Site URL**: `https://<usuario>.github.io/<repositorio>/`
- **Redirect URLs**: adicione a mesma URL e `http://localhost:5173/**`

Isso faz os links de confirmação de cadastro e de "esqueci minha senha" voltarem
para o app. O envio de e-mails do plano gratuito tem limite baixo por hora; para uso
pessoal você pode desligar a confirmação em **Authentication → Providers → Email →
Confirm email**.

### 3. Rodar localmente
Crie `.env.local` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` e rode `npm run dev`.

### 4. Publicar
No GitHub: **Settings → Secrets and variables → Actions → Variables**, crie
`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` e faça um novo push (ou rode o
workflow manualmente).

### Como funciona
- `src/services/supabase/supabaseDataSource.ts` implementa a mesma interface
  `DataSource` da versão local; a interface do app não muda.
- No primeiro login de uma conta vazia, se o navegador tiver uma coleção local, o
  app oferece enviá-la para a conta (os dados locais ficam como cópia).
- Ao voltar para a aba depois de 30 s, os dados são recarregados, refletindo o que
  foi alterado em outro aparelho.
- A base de perfumes importada (autocompletar) continua local em cada navegador.
- No plano gratuito, projetos sem uso por cerca de uma semana são pausados; basta
  reativá-los no painel do Supabase.

Variáveis `VITE_*` são embutidas no JavaScript enviado ao navegador: **nunca
coloque chaves secretas nelas**. A integração atual (Open-Meteo) não usa chave.
Para um provedor que exija chave, implemente `WeatherProvider`
(`src/services/weather/types.ts`) chamando uma função de servidor — por exemplo,
`api/weather.ts` na Vercel — que guarda a chave em variável de ambiente do servidor.

## Publicação

O app usa `HashRouter` (URLs como `/#/colecao`), então funciona em qualquer
hospedagem estática sem regras de reescrita.

### Vercel

1. Importe o repositório em vercel.com → *Add New Project*.
2. Framework: **Vite** (detectado automaticamente). Build: `npm run build`. Saída: `dist`.
3. Não é preciso definir `VITE_BASE_PATH`.

Ou pela CLI: `npx vercel` e depois `npx vercel --prod`.

### GitHub Pages

O workflow `.github/workflows/deploy-pages.yml` publica automaticamente a cada
push na branch `main`:

1. Em *Settings → Pages*, escolha **Source: GitHub Actions**.
2. Faça push para `main`. O workflow define `VITE_BASE_PATH=/<nome-do-repositório>/`.

Para publicar manualmente: `VITE_BASE_PATH=/<repositorio>/ npm run build` e envie
o conteúdo de `dist/` para a branch/pasta configurada no Pages.

> No Windows com Git Bash, prefixe com `MSYS_NO_PATHCONV=1`; caso contrário o
> shell converte `/repositorio/` em um caminho do disco. No PowerShell:
> `$env:VITE_BASE_PATH='/repositorio/'; npm run build`.

## O que está pronto

- **Início**: saudação, data, clima (API ou manual), recomendação do momento com
  pontuação e justificativa, registro de uso, resumos, favoritos e atalhos.
- **Minha coleção**: cadastro, edição, exclusão, favoritos, busca, filtros (marca,
  família, concentração, ocasião, período, status), ordenação, grade/lista, imagens
  locais com placeholder elegante.
- **Recomendações**: perguntas guiadas (ocasião, ambiente, intensidade, preferência
  do dia), período ajustável, ranking com critério a critério, confiança e escolha
  manual quando faltam dados. Ver [docs/RECOMENDACOES.md](docs/RECOMENDACOES.md).
- **Registro de uso**: data/hora, ocasião, ambiente, clima, avaliação e
  observações; edição e exclusão; aviso antes de duplicar um registro.
- **Estatísticas**: totais, rankings, top 3 da semana e do mês, por ocasião, marca
  e família, frequência, dia da semana, comparação entre semanas e meses, pouco
  utilizados, histórico e **retrospectiva semanal** — tudo a partir de registros reais.
- **Explorar**: catálogo local de demonstração (identificado e não verificado) e
  análise de lacunas da coleção com sugestões justificadas.
- **Preços**: cadastro manual de ofertas, agrupamento de produtos equivalentes,
  preço total e por ml. A comparação automática está claramente indicada como
  indisponível.
- **Configurações**: nome, tema (escuro/claro/sistema), unidade de temperatura,
  cidade, preferências olfativas, orçamento, pesos do motor, exportar/importar JSON,
  carregar/remover exemplos e apagar tudo.

## Base de perfumes (autocompletar)

Em **Configurações → Base de perfumes** você pode carregar um catálogo grande. Com ele,
o campo "Nome" do cadastro sugere perfumes e versões (EDT, EDP, Parfum, flankers) e,
ao escolher uma, preenche marca, concentração, ano, perfumistas, acordes, família
sugerida e as notas de saída, coração e fundo. Também alimenta Explorar e a análise
de lacunas.

| Opção | Como | Observações |
|---|---|---|
| **Parfumo (TidyTuesday 2024)** | Botão "Baixar base Parfumo" | ~59 mil perfumes, ~31 mil com pirâmide. Coletado do Parfumo por Olga G.; **sem licença declarada** — uso pessoal. |
| **Fragrantica.com Fragrance Dataset (Kaggle)** | Baixe `fra_cleaned.csv` com sua conta Kaggle e use "Importar CSV" | ~24 mil perfumes. Licença informada por terceiros como CC BY-NC-SA 4.0 (não comercial); dados originalmente do Fragrantica. |
| **Sua própria planilha** | "Importar CSV" | Cabeçalhos reconhecidos: nome, marca, concentração, ano, família, notas de saída/coração/fundo, acordes, perfumistas. |

Detalhes técnicos:

- A importação roda em um Web Worker; o separador (`,` `;` tab) e a codificação
  (UTF-8 ou Latin-1) são detectados automaticamente.
- Defeitos conhecidos da base Parfumo são corrigidos: números iniciais separados do
  nome ("1" + "Million") e marca/ano/concentração repetidos no nome.
- As ~300 notas e acordes mais frequentes são traduzidos para o português
  (`src/data/noteTranslations.ts`); as demais ficam no original.
- A família olfativa é **sugerida** a partir do primeiro acorde mapeável e sinalizada
  como tal no formulário.
- A base fica no IndexedDB (`parfumania-catalog`), não entra no backup JSON e **não
  deve ser publicada junto com o app**: o repositório e o deploy contêm apenas o
  catálogo de demonstração.
- Não existe API pública oficial do Fragrantica, e o app não faz scraping.
- Os dados são comunitários e podem ter lacunas (ex.: na base Parfumo, Sauvage EDT e
  EDP estão sem notas). Tudo é editável depois de preenchido.

## Dados de demonstração

Na primeira execução, 5 perfumes de exemplo são carregados com o selo **Demo**.
Eles podem ser editados (passam a ser seus) ou removidos de uma vez. Nenhum
registro de uso fictício é criado, então estatísticas começam vazias.

## Privacidade e armazenamento

- Perfumes, registros, ofertas e configurações: `localStorage` (prefixo `parfumania.`).
- Imagens: IndexedDB (`parfumania-images`), redimensionadas para no máximo 900 px.
- A localização do navegador só é pedida ao clicar em "Usar minha localização",
  é arredondada (~1 km) e mantida apenas em memória durante a sessão. A cidade
  preferida guarda somente nome e coordenadas do centro da cidade.
- Limpar os dados do site no navegador apaga tudo: exporte backups em Configurações.

## Arquitetura

```
src/
  components/     componentes visuais reutilizáveis (botões, modais, campos, cards)
  layouts/        estrutura com navegação lateral (desktop) e inferior (celular)
  pages/          páginas por rota
  features/       componentes e lógica por funcionalidade
    collection/   filtros, formulário (modelo + validação), cards
    usage/        diálogo e lista de registros de uso
    recommendations/ cartão e justificativa
    statistics/   cálculos puros (stats.ts), gráficos, retrospectiva
    discovery/    análise de lacunas, detalhe do catálogo
    prices/       agrupamento de ofertas e formulário
    settings/     pesos, cidade, backup
    weather/      widget e entrada manual de clima
  services/
    storage/      repositórios, fonte de dados local, migrações, backup
    weather/      provedor meteorológico (Open-Meteo) atrás de uma interface
    recommendations/ motor de regras puro e testado
    catalog/      provedor de catálogo (local de demonstração)
    prices/       contrato para futuros provedores de preço
  hooks/          estado da aplicação (dados, clima, toasts)
  data/           opções, padrões, catálogo e coleção de demonstração
  types/          tipos de domínio
  utils/          datas, formatação, texto, imagens
```

**Trocar a persistência**: a UI só conhece a interface `DataSource`
(`src/services/storage/repositories.ts`), que é assíncrona. Para usar uma API ou
banco remoto, implemente essa interface e passe-a ao `AppDataProvider` em
`src/main.tsx`.

**Evoluir o esquema**: incremente `CURRENT_SCHEMA_VERSION` e registre a migração em
`src/services/storage/migrations.ts`. Ela roda na inicialização e ao importar
backups antigos.

## Dependências externas em tempo de execução

| Serviço | Uso | Obrigatório? |
|---|---|---|
| Open-Meteo (forecast + geocoding) | clima atual, previsão e busca de cidade | Não — há entrada manual |
| Google Fonts | Cormorant Garamond e Inter | Não — há fontes de sistema como alternativa |
