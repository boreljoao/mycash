# Meu Caixa

Aplicação web de gestão financeira pessoal, responsiva e sem dependências.

## Funcionalidades

- Dashboard com patrimônio, caixa, entradas, saídas, taxa de poupança e projeção
- Evolução do caixa e gastos por categoria
- Cadastro, busca, filtro e exclusão de movimentações
- Cadastro de contas e cartões
- Importação de fatura em CSV
- Orçamento mensal por categoria
- Controle simplificado de investimentos e aportes
- Exportação de backup em JSON
- Persistência local no navegador com localStorage

## Executar

Abra `index.html` no navegador ou use qualquer servidor estático:

```bash
npx serve .
```

O projeto não envia dados para servidores. Os dados cadastrados permanecem no navegador em que o app é utilizado.

## CSV aceito

```csv
data,descricao,valor,categoria,conta
14/09/2026,Supermercado,250.90,Alimentação,Conta principal
```

Valores positivos são tratados como saídas; valores negativos, como entradas.
