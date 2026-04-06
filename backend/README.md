
# NestJS Drizzle Template

A robust project template for building scalable server-side applications with [NestJS](https://nestjs.com/), [Drizzle ORM](https://orm.drizzle.team/), and PostgreSQL. This template provides a clean architecture, environment-based configuration, validation, Swagger API docs, and rate limiting out of the box.

---

## Features

- **NestJS 11**: Modular, testable, and scalable Node.js framework.
- **Drizzle ORM**: Type-safe, modern ORM for PostgreSQL.
- **PostgreSQL**: Production-ready relational database support.
- **Environment-based config**: Centralized, validated config using `@nestjs/config` and `joi`.
- **Swagger**: Auto-generated OpenAPI docs.
- **Rate Limiting**: Built-in throttler with async config.
- **Testing**: Jest for unit and e2e tests.
- **Pre-configured scripts**: For development, production, linting, and testing.

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/RubenOAlvarado/nestjs-drizzle-template.git
cd nestjs-drizzle-template
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp env.example .env
```

**Key variables:**

- `APP_PORT`: Port to run the server (default: 3000)
- `NODE_ENV`: `development` | `production` | `test`
- `API_VERSION`: API version prefix (default: 1)
- `ALLOWED_ORIGINS`: CORS allowed origins
- `DATABASE_URL`: PostgreSQL connection string
- `SWAGGER_*`: Swagger docs config
- `THROTTLE_TTL`, `THROTTLE_LIMIT`: Rate limiting

### 4. Configure & start PostgreSQL with Docker

Update the `docker-compose.yml` if necessary.
Configure the `DATABASE_URL` in your `.env` file to match the Docker setup.

```bash
docker-compose up -d db
```

### 5. Database setup & migrations

This template uses [Drizzle Kit](https://orm.drizzle.team/docs/overview) for migrations.

- Define your schema in `src/common/database/schemas/`
- Configure Drizzle in `drizzle.config.ts`
- Uncomment the schemas importation in `src/common/database/drizzle.client.ts` to register your schemas.
- Run migrations (see Drizzle Kit docs for commands)

### 6. Run the application

```bash
# Development
npm run start:dev

# Production build
npm run build
npm run start:prod
```

### 7. API Documentation

If enabled, Swagger docs are available at:

```
http://localhost:<APP_PORT>/<SWAGGER_PATH>
```

---

## Scripts

| Script            | Description                       |
|-------------------|-----------------------------------|
| `start`           | Start app (default)               |
| `start:dev`       | Start in watch mode               |
| `start:prod`      | Start compiled app                |
| `build`           | Compile TypeScript                |
| `test`            | Run unit tests                    |
| `test:e2e`        | Run end-to-end tests              |
| `test:cov`        | Test coverage                     |
| `lint`            | Lint code with ESLint             |
| `format`          | Format code with Prettier         |

---

## Project Structure

```
src/
  app.module.ts           # Main NestJS module
  main.ts                 # App entrypoint
  common/
    config/               # Centralized config & validation
    database/             # Drizzle client, module, schemas
    types/                # Shared TypeScript types
test/                     # Jest e2e tests
drizzle.config.ts         # Drizzle ORM config
.env.example              # Example environment variables
```

---

## Configuration

- All config is loaded and validated via `@nestjs/config` and `joi`.
- See `src/common/config/validation/` for schemas.
- See `src/common/config/configurations/` for config sources.

---

## Testing

- **Unit tests:** `npm run test`
- **E2E tests:** `npm run test:e2e`
- **Coverage:** `npm run test:cov`

---

## Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a pull request

Please follow the code style and add tests for new features.

---

## FAQ

**Q: Can I use another database?**
A: This template is designed for PostgreSQL with Drizzle ORM. For other databases, you will need to adjust the Drizzle config and dependencies.

**Q: How do I add new modules or features?**
A: Use the NestJS CLI (`nest generate module|service|controller ...`) and follow the modular structure.

**Q: Where do I define my database schema?**
A: In `src/common/database/schemas/` using Drizzle's schema definition syntax.

---

## Troubleshooting

- **App won't start:** Check your `.env` file for missing or invalid variables.
- **Database connection errors:** Ensure your `DATABASE_URL` is correct and the database is running.
- **Swagger docs not available:** Make sure `SWAGGER_ENABLED=true` in your `.env`.
- **CORS issues:** Adjust `ALLOWED_ORIGINS` in your `.env`.

If you encounter other issues, please open an issue in the repository.

---

## Contact

For questions, suggestions, or support, feel free to contact me:

- **Author:** Ruben O. Alvarado
- **GitHub:** [RubenOAlvarado](https://github.com/RubenOAlvarado)
- **X:** [RubenOAlvarado](https://x.com/RubenOAlvarado)
- **LinkedIn:** [RubenOAlvarado](https://www.linkedin.com/in/ruben-alvarado-molina-9020010/)

---

## License

MIT © 2025 Ruben O. Alvarado
