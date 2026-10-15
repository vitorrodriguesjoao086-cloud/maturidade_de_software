# FITZONE — Plataforma de academia

API REST PHP e frontend responsivo para gerenciamento de treinos de academia.

## O que já está implementado

- Login de aluno e professor usando e-mail e senha.
- Cadastro de usuários com perfil `student` ou `teacher`.
- Autenticação por Bearer Token.
- Logout e expiração de tokens.
- Professor consegue listar e consultar alunos.
- Catálogo de exercícios.
- Professor pode criar/editar planos para qualquer aluno.
- Aluno pode criar/editar o próprio plano.
- Professor e aluno podem visualizar os planos permitidos para seus perfis.
- Adição e remoção de exercícios de um plano.
- Banco MySQL com relacionamentos e chaves estrangeiras.
- Senhas armazenadas com `password_hash`.
- API preparada para receber um frontend React, Vue, HTML/JS ou outro cliente depois.

## Estrutura

```text
fitzone-backend/
├── config/
│   └── config.php
├── database/
│   └── schema.sql
├── public/
│   ├── app.js
│   ├── index.html
│   ├── .htaccess
│   ├── index.php
│   └── styles.css
└── README.md
```

## Requisitos

- PHP 8.1+ recomendado
- MySQL 8+ ou MariaDB compatível
- Apache com `mod_rewrite` ou servidor PHP embutido para desenvolvimento
- Extensão PDO MySQL habilitada

## 1. Criar o banco

Execute:

```bash
mysql -u root -p < database/schema.sql
```

Depois confira `config/config.php` ou defina as variáveis de ambiente:

```text
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=fitzone
DB_USER=root
DB_PASS=sua_senha
TOKEN_TTL_HOURS=24
CORS_ORIGIN=*
```

## 2. Rodar localmente sem Apache

Dentro da pasta do projeto:

```bash
php -S localhost:8000 -t public public/index.php
```

A API ficará em:

```text
http://localhost:8000
```

Abra o mesmo endereço no navegador para acessar o frontend FitZone. O frontend e a API são servidos pelo mesmo projeto e usam a sessão autenticada para chamar os endpoints.

O frontend oferece cadastro e login de alunos e professores. Alunos podem consultar e montar seus próprios treinos; professores podem acompanhar alunos e montar planos para eles. O catálogo compartilhado permite filtrar exercícios por grupo muscular.

## 3. Usuários de teste

Professor:

```text
E-mail: professor@fitzone.local
Senha: password
```

Aluno:

```text
E-mail: aluno@fitzone.local
Senha: password
```

## Endpoints principais

### Geral

`GET /health`

### Autenticação

`POST /auth/register`

```json
{
  "name": "João Silva",
  "email": "joao@email.com",
  "password": "123456",
  "role": "student",
  "phone": "81999990000",
  "birth_date": "2005-01-20"
}
```

`POST /auth/login`

```json
{
  "email": "aluno@fitzone.local",
  "password": "password"
}
```

A resposta fornece um `token`. Use-o nas próximas chamadas:

```text
Authorization: Bearer SEU_TOKEN
```

`POST /auth/logout`

### Usuário logado

`GET /me`

### Professor

`GET /students`

`GET /students/{id}`

`GET /plans`

`POST /plans`

Exemplo para criar plano para um aluno:

```json
{
  "user_id": 2,
  "name": "Treino Hipertrofia A",
  "description": "Treino de peito e tríceps",
  "goal": "Hipertrofia",
  "status": "draft"
}
```

### Aluno

`GET /plans`

`POST /plans`

O aluno não precisa enviar `user_id`; o backend usa automaticamente o usuário autenticado.

```json
{
  "name": "Meu treino",
  "description": "Treino montado por mim",
  "goal": "Condicionamento",
  "status": "draft"
}
```

### Exercícios

`GET /exercises`

`GET /exercises?muscle_group=Pernas`

### Exercícios dentro do plano

`POST /plans/{plan_id}/exercises`

```json
{
  "exercise_id": 5,
  "day": 1,
  "sets": 4,
  "repetitions": "10-12",
  "rest_seconds": 90,
  "load_value": 40,
  "notes": "Aumentar carga se executar com boa técnica",
  "position": 1
}
```

`DELETE /plans/{plan_id}/exercises/{plan_exercise_id}`

## Regra de acesso

- `student`: acessa somente seus próprios planos e pode montar/editar os próprios planos.
- `teacher`: acessa os alunos e pode criar/editar planos de qualquer aluno.
- O catálogo de exercícios é compartilhado.
- A API não expõe `password_hash` nas respostas.
- Interface web para login/cadastro, treinos, catálogo de exercícios e acompanhamento de alunos.

## Próximos passos sugeridos

1. Adicionar validações mais específicas para dados de aluno.
2. Criar histórico de evolução/cargas.
3. Adicionar frequência/presença na academia.
4. Adicionar avaliação física.
5. Criar recuperação de senha por e-mail.
6. Adicionar paginação aos alunos e exercícios.
7. Criar o frontend consumindo esta API.
