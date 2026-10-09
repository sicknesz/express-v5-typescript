# Modern Express v5 & TypeScript Boilerplate

A clean, modern, and production-ready boilerplate for Node.js, built from scratch to replace outdated generators like `express-generator`. Designed for developers who demand strict typing, modern ESM standards, and out-of-the-box API documentation.

---

## Why this boilerplate?

The traditional `express-generator` is outdated: it relies on CommonJS (`require()`), plain JavaScript, and ancient idioms (var instead of let/const, not using Promise/async/await correctly, and other bad practices). This template provides a modern foundation reflecting current software engineering standards:
* **No legacy CommonJS:** Only ECMAScript Modules (`import`/`export` syntax). - Still possible to use very old package needed a require() (see below)

* **Strict TypeScript:** Full type safety from request to response.
* **Express v5 Ready:** Leveraging the latest asynchronous routing and middleware capabilities of Express 5.
* **OpenAPI / Swagger UI:** Interactive API documentation automatically configured right out of the box.




## If you still need require() 

```typescript
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
```


---

## Stack

* **Node.js** (LTS)
* **Express v5**
* **TypeScript v7** (with strict type checking)
* **ES Modules (ESM)**
* **Swagger-UI Express & OpenAPI 3.0**

---

## Folder Structure


```
├── src/
│   ├── config/      # Environment and app configuration
│   ├── controllers/ # Request handlers
│   ├── routes/      # API route definitions
│   ├── public       # public folder for static files
│   └── server.ts    # Application entry point
├── .env.example     # Environment variables template
├── tsconfig.json    # TypeScript configuration (ESM target)
├── vitest.config.ts # Vitest configuration
└── package.json     # Project configuration
```

---

## Getting Started

### 1. Clone and Install

```bash
git clone https://github.com/sicknesz/express-v5-typescript.git
cd express-v5-typescript
bun install
```

### 2. Configure Environment

Copy the example environment file:
```bash
cp .env.example .env
```

### 3. Run in Development Mode

```bash
bun run dev
```

### 4. Build for Production

```bash
bun run build
bun start
```

### 5. Run tests for production

```bash
bun test --coverage
```
---

Coverage at the moment : 

```
--------------------|---------|---------|-------------------
File                | % Funcs | % Lines | Uncovered Line #s
--------------------|---------|---------|-------------------
All files           |  100.00 |  100.00 |
 crypto/provider.ts |  100.00 |  100.00 | 
 routes/index.ts    |  100.00 |  100.00 | 
 routes/users.ts    |  100.00 |  100.00 | 
 server.ts          |  100.00 |  100.00 | 
 app.ts             |  100.00 |  100.00 | 
--------------------|---------|---------|-------------------
```

## API Documentation

Once the server is running, access the interactive Swagger UI documentation at:
```
http://localhost:3000/docs
```

---

## About me

Crafted by **Sylvain Roccaserra** as a clean demonstration of modern backend architecture, clean code practices, and robust Node.js engineering.

---

## License

This project is open-source and available under the [MIT License](LICENSE).