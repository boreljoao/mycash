# Meu Caixa

Aplicação web de gestão financeira pessoal. Funciona offline no navegador e, opcionalmente, sincroniza seus dados entre computador e celular através de um banco de dados Supabase gratuito.

🔗 https://mycash-three.vercel.app

## Funcionalidades

**Visão geral**
- Patrimônio total (caixa + investimentos − faturas em aberto), com botão para ocultar valores
- Meta de patrimônio editável e projeção de 12 meses baseada na sua média real
- Entradas, saídas, saldo e taxa de poupança do mês, comparados ao mês anterior
- Gráfico de evolução do caixa em 6 ou 12 meses, calculado a partir dos lançamentos
- Rosca de gastos por categoria e lista de próximos vencimentos

**Movimentações**
- Entradas, saídas e transferências, com parcelamento em até 24 vezes
- Busca por texto e filtros por tipo, categoria, conta/cartão e mês
- Qualquer lançamento é editável ou removível com um toque

**Gastos & Contas**
- Contas a pagar fixas ou recorrentes, com marcação de pago e alerta de vencidas
- Orçamento por categoria com barra de progresso e aviso de estouro
- Resumo de gastos fixos versus variáveis do mês

**Contas & Cartões**
- Saldo de cada conta calculado a partir dos lançamentos
- Cartões com limite, fatura em aberto, fechamento, vencimento e pagamento de fatura

**Investimentos**
- Várias contas de investimento (Tesouro, CDB, ações, fundos, cripto e outros)
- Aportes, resgates e atualização de valor, com rentabilidade e histórico

**Extras**
- Adicionar lançamento por voz em português
- Instalável como aplicativo no celular (PWA)
- Importação de fatura em CSV e backup em JSON

## Adicionar por voz

Toque no botão 🎤 e fale naturalmente. O app identifica valor, tipo, categoria, data e forma de pagamento:

| Você fala | O app entende |
|---|---|
| "Gastei 45 reais no mercado hoje" | Saída · R$ 45,00 · Alimentação · hoje |
| "Paguei 150 de luz no cartão" | Saída · R$ 150,00 · Moradia · Cartão |
| "Recebi 4 mil de salário" | Entrada · R$ 4.000,00 · Salário |
| "Gastei trinta e cinco reais de uber ontem" | Saída · R$ 35,00 · Transporte · ontem |
| "Netflix 39 e 90 centavos todo mês" | Saída · R$ 39,90 · Assinaturas · recorrente |

O formulário abre preenchido para você conferir antes de salvar. O reconhecimento de voz funciona no Chrome (computador e Android) e no Safari (iPhone). Em navegadores sem suporte, digite a frase no mesmo painel.

## Sincronizar entre aparelhos

Sem configuração, os dados ficam apenas no navegador em que você usa o app. Para ver tudo no mesmo lugar no computador e no celular:

1. Crie uma conta e um projeto gratuito em [supabase.com](https://supabase.com).
2. No projeto, abra **SQL Editor**, cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**.
3. Em **Project Settings → API**, copie a **Project URL** e a chave **anon public**.
4. No app, vá em **Ajustes & Sincronização**, cole os dois valores, escolha um código de sincronização e conecte.
5. Repita o passo 4 no celular usando exatamente o mesmo código.

O código de sincronização funciona como a senha dos seus dados: ele nunca é enviado ao servidor, apenas o seu hash SHA-256, que identifica a linha da tabela. Use um código longo e que só você conheça.

As alterações sobem automaticamente e o app busca novidades ao abrir, ao voltar para a aba e a cada 30 segundos.

Se preferir que todos os aparelhos já venham configurados, preencha `SUPABASE_URL` e `SUPABASE_ANON_KEY` em `config.js`. A chave anon é pública por design e pode ficar no repositório.

## Instalar no celular

- **Android (Chrome):** menu ⋮ → "Adicionar à tela inicial" ou "Instalar app"
- **iPhone (Safari):** botão Compartilhar → "Adicionar à Tela de Início"

## Executar localmente

```bash
npx serve .
```

Não há dependências nem etapa de build. O projeto é HTML, CSS e JavaScript.

## CSV aceito

```csv
data,descricao,valor,categoria,conta
14/09/2026,Supermercado,250.90,Alimentação,Conta principal
```

Valores positivos são tratados como saídas; valores negativos, como entradas. Se a coluna `conta` corresponder ao nome de um cartão cadastrado, o lançamento entra na fatura dele.
