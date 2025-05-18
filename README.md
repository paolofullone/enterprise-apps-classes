# Desenvolvendo Aplicações Enterprise, Arquiteturas Evolutivas e Modulares (Aulas)

Este repositório contém o código-fonte usado no curso **Desenvolvendo Aplicações Enterprise, Arquiteturas Evolutivas e Modulares**, com foco em como evoluir um sistema real partindo de um monolito simples até uma estrutura modular, testável e preparada para escalar.

O objetivo do curso é mostrar **como modularizar sistemas na prática**, sem overengineering e com decisões técnicas guiadas por contexto real.

# 🚨Leia com atenção!

Esse repositório segue a ordem cronológica das aulas do curso, portanto, o código pode não estar completo ou funcional em alguns commits. É recomendado seguir as aulas para entender o contexto de cada mudança.
E com a conclusão do curso, o código final esta completo e funcional e
não sera mais atualizado com tanta frequência.

Nosso lab de exploração para os conteúdos futuros é o [fakeflix](https://github.com/tech-leads-club/fakeflix), use esse repositório para implementações confiáveis e o fakeflix para experimentações e novas ideias.

---

## 📚 O que você vai encontrar aqui

Cada etapa do curso representa um momento de evolução arquitetural:

- ✅ Módulo único inicial com arquitetura simples
- 🔧 Evolução de Arquiteturas em camadas
- 🧩 Separação por contexto (content, streaming, billing…)
- ⚙️ Integração com filas usando **BullMQ**
- 🔌 Separação de entrypoints (API / Worker)
- 🧠 Integração com IA via Google Gemini
- 🧭 Boas práticas de governança técnica e modularização
- 💾 Uso de TypeORM com transações gerenciadas
- 🧪 Testes automatizados de ponta a ponta

---

## 📂 Estrutura do projeto

```bash
.
├── src
│   ├── module
│   │   ├── billing
│   │   │   ├── __test__
│   │   │   ├── core
│   │   │   ├── http
│   │   │   ├── integration
│   │   │   ├── persistence
│   │   │   └── billing.module.ts
│   │   ├── content
│   │   │   ├── __test__
│   │   │   ├── admin
│   │   │   ├── catalog
│   │   │   ├── shared
│   │   │   ├── video-processor
│   │   │   └── content.module.ts
│   │   ├── identity
│   │   │   ├── __test__
│   │   │   ├── core
│   │   │   ├── http
│   │   │   ├── persistence
│   │   │   └── identity.module.ts
│   │   └── shared
│   │       ├── core
│   │       ├── module
│   │       └── shared.module.ts

```

## ⚙ Executando e testando o projeto

### Instalando as dependências

```bash
yarn install
```

### Iniciando banco de dados e Redis

```bash
yarn docker:start:deps
```

### Aplicando migrations

```bash
yarn db:migrate:all
```

### Testando

```bash
yarn test:e2e
```

### Inicializando API e Worker

```bash
yarn build

node dist/main.js //inicializa a API
node dist/video-processor-worker.main.js //Inicializa o worker
```

**Principais Tecnologias e Bibliotecas**

- **NestJS**: Framework para construção de APIs em Node.js.
- **GraphQL**: Utilizado para algumas partes da API.
- **TypeORM**: ORM para PostgreSQL.

**Infraestrutura e DevOps**

- **Docker**: Utilizado para gerenciar os serviços necessários para o projeto.
- **Winston + nest-winston**: Logging centralizado.
- **dotenv**: Gerenciamento de variáveis de ambiente.

**Segurança**

- **bcrypt**: Hashing de senhas.
- **jsonwebtoken (JWT)**: Autenticação baseada em tokens.
- **class-validator & class-transformer**: Validação de entrada de dados.

**Testes**

- **Jest**: Framework de testes unitários.
- **Supertest**: Utilizado para testes e2e.
- **Nock**: Mocking de chamadas HTTP externas.

### Contribuindo

Todos membros da Tech Leads club são livres para contribuir com ideas para o projeto, basta abrir um pull request.

1. Crie uma branch para sua feature/fix (`git checkout -b minha-feature`).
2. Faça o commit das mudanças (`git commit -m 'Adiciona nova feature'`).
3. Envie para a branch principal (`git push origin minha-feature`).
4. Abra um Pull Request.

### Licença

Esse código é proprietário da Tech Leads club e não deve ser compartilhado externamente.
