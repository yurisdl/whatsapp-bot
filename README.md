# WhatsApp ChatBot para atendimento

Bot de atendimento para WhatsApp usando Baileys (WhatsApp Web API), NLP.js e MySQL.

## 📁 Estrutura do Projeto

```
whatsapp-bot/
├── src/
│   ├── api/                    # API e checkout
│   │   └── checkout.js         # Endpoints de checkout e MercadoPago
│   ├── config/                 # Configurações
│   │   └── env.js              # Variáveis de ambiente
│   ├── database/               # Camada de dados
│   │   └── mysql.js            # Operações com MySQL
│   ├── handlers/               # Handlers de mensagens
│   │   ├── intents.js          # Handlers para cada intent
│   │   └── messageHandler.js   # Controlador principal
│   ├── services/               # Serviços
│   │   ├── nlp.js              # Serviço de NLP
│   │   └── whatsapp.js         # Serviço WhatsApp
│   └── index.js                # Arquivo principal (bot + servidor)
├── training/                   # Arquivos de treinamento do NLP
│   ├── train-model.js          # Script para treinar o modelo
│   └── nlp-intents.json        # Intenções e frases de treinamento
├── assets/                     # Arquivos estáticos (frontend)
│   ├── css/                    # Estilos CSS
│   │   └── style.css
│   ├── images/                 # Imagens dos produtos
│   ├── js/                     # Scripts frontend
│   │   ├── index.js            # Lógica do checkout
│   ├── index.html              # Página de checkout
│   ├── payment-success.html    # Página de pagamento aprovado
│   ├── payment-pending.html    # Página de pagamento pendente
│   └── payment-failure.html    # Página de pagamento recusado
├── database/                   # Banco de dados
│   └── schema.sql              # Schema do MySQL
├── models/                     # Modelos treinados
│   └── model.private.nlp       # Modelo NLP treinado
├── auth_info_baileys/          # Sessão do WhatsApp (gerado automaticamente)
├── nodemon.json                # Configuração do nodemon
├── .env                        # Variáveis de ambiente
├── .gitignore
└── package.json
```

## 🚀 Como Usar

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar banco de dados
Importe o schema SQL:
```bash
mysql -u root -p < database/schema.sql
```

### 3. Configurar .env
Crie um arquivo `.env` na raiz do projeto:
```env
SERVER_URL=http://localhost:3000

# MySQL Database
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=sua_senha
MYSQL_DATABASE=whatsapp_bot

# MercadoPago
MERCADOPAGO_ACCESS_TOKEN=seu_mercadopago_token
MERCADOPAGO_PUBLIC_KEY=seu_mercadopago_key
```

### 4. Rodar o bot
```bash
npm start
```

Ou em modo de desenvolvimento:
```bash
npm run dev
```

### 5. Escanear QR Code
Escaneie o QR code que aparece no terminal com seu WhatsApp.

## 📦 Funcionalidades

- ✅ Saudações e despedidas
- ✅ Listagem de produtos com imagens
- ✅ Adicionar produtos ao carrinho
- ✅ Visualizar carrinho
- ✅ Checkout via MercadoPago
- ✅ Processamento de linguagem natural (NLP)
- ✅ Persistência de dados em MySQL
- ✅ Servidor Express integrado
- ✅ API REST para operações de banco de dados
- ✅ Notificações de status do pedido

## 🛠️ Tecnologias

- **Baileys** - WhatsApp Web API
- **Express** - Servidor web para servir assets e API
- **NLP.js** - Processamento de linguagem natural
- **MySQL/MariaDB** - Banco de dados relacional
- **MercadoPago** - Gateway de pagamento
- **Axios** - Cliente HTTP

## 🌐 Servidor Integrado

O bot inclui um servidor Express integrado que:
- Serve arquivos estáticos da pasta `assets`
- Fornece endpoints de API para checkout
- Gerencia notificações do MercadoPago
- Roda por padrão na porta 3000

## ⚙️ Scripts Disponíveis

- `npm start` - Inicia o bot
- `npm run dev` - Inicia o bot em modo de desenvolvimento (com nodemon)
- `npm run train` - Treina o modelo NLP com as intenções e produtos do MySQL

## 🤖 Treinamento do NLP

O bot usa processamento de linguagem natural para entender as mensagens dos usuários.

### Adicionar novas intenções

1. Edite o arquivo `training/nlp-intents.json`
2. Adicione novas frases para as intenções existentes ou crie novas intenções
3. Execute `npm run train` para retreinar o modelo
4. Reinicie o bot

### Exemplo de estrutura do nlp-intents.json:

```json
{
  "greeting": ["oi", "olá", "bom dia"],
  "showProducts": ["ver produtos", "catálogo"]
}
```

### Treinamento automático com produtos

O script de treinamento busca automaticamente os produtos do MySQL e treina o NLP para reconhecer os nomes dos produtos e suas variações.

## 📝 Como Funciona

1. O bot se conecta ao WhatsApp via Baileys
2. Usuários enviam mensagens que são processadas pelo NLP.js
3. O NLP identifica a intenção (listar produtos, adicionar ao carrinho, etc.)
4. O bot consulta/atualiza dados no MySQL
5. Para checkout, gera um link de pagamento do MercadoPago
6. Após o pagamento, o MercadoPago notifica o bot via webhook
7. O bot atualiza o pedido e notifica o cliente

## 🗄️ Estrutura do Banco de Dados

O banco de dados MySQL possui as seguintes tabelas:

### users
- `id` - ID único do usuário (auto increment)
- `phone_number` - Número de telefone (único, varchar(20))
- `state` - Estado atual da conversa (varchar(50), padrão: 'greeting')
- `name` - Nome do usuário (varchar(255))
- `email` - Email do usuário (varchar(255))
- `address` - Endereço do usuário (varchar(500))
- `last_shown_products` - JSON com últimos produtos mostrados (longtext)
- `created_at` - Data de criação (timestamp)
- `updated_at` - Data de atualização (timestamp)

### products
- `id` - ID único do produto (auto increment)
- `title` - Nome do produto (varchar(255))
- `color` - Cor do produto (varchar(255))
- `price` - Preço (float)
- `quantity` - Quantidade em estoque (int)
- `image_url` - URL da imagem (varchar(500))
- `created_at` - Data de criação (timestamp)
- `updated_at` - Data de atualização (timestamp)

### orders
- `id` - ID único do pedido (auto increment)
- `user_id` - Número de telefone do usuário (varchar(20), FK para users.phone_number)
- `status` - Status do pedido (varchar(50), padrão: 'Pending')
- `shipping_address` - Endereço de entrega (varchar(255))
- `payer_id` - ID do pagador no MercadoPago (varchar(255))
- `payer_email` - Email do pagador (varchar(255))
- `amount` - Valor total (float)
- `created_at` - Data de criação (timestamp)
- `updated_at` - Data de atualização (timestamp)

### order_products
- `order_id` - ID do pedido (int, FK para orders.id)
- `product_id` - ID do produto (int, FK para products.id)
- `quantity` - Quantidade do produto (int, padrão: 1)
- Chave primária composta: (`order_id`, `product_id`)
