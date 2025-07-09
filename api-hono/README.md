# Hono API Server

A modern API server built with Hono, Effect.ts, and DynamoDB, replacing Strapi with functional programming principles.

## Features

- **Hono**: Lightweight, fast web framework
- **Effect.ts**: Functional programming with proper error handling
- **DynamoDB**: NoSQL database with ElectroDB for type safety
- **OpenAuth**: Modern authentication system
- **Sharp**: High-performance image processing
- **TypeScript**: Full type safety throughout

## Quick Start

### Prerequisites

- Node.js 22.17.0 or higher
- pnpm 10.12.4
- Docker (for local development)

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env

# Start development environment
pnpm dev:setup
pnpm dev
```

### Development

```bash
# Start development server with database
pnpm dev

# Type checking
pnpm typecheck

# Run tests
pnpm test

# Lint and format
pnpm lint:fix
pnpm format
```

### Database Management

```bash
# Create tables
pnpm db:create

# Run migrations
pnpm db:migrate

# Seed data
pnpm db:seed

# Reset database
pnpm db:reset
```

### Build and Deploy

```bash
# Build for production
pnpm build

# Start production server
pnpm start
```

## Project Structure

```
src/
├── config/          # Configuration files
├── services/        # Effect.ts services
├── models/          # ElectroDB models
├── routes/          # Hono route handlers
├── middleware/      # Custom middleware
├── utils/           # Utility functions
├── types/           # TypeScript types
└── schemas/         # Validation schemas
```

## API Endpoints

- `GET /api/posts` - List posts
- `POST /api/posts` - Create post
- `GET /api/categories` - List categories
- `GET /api/galleries` - List galleries
- `POST /api/media` - Upload media
- `POST /auth/login` - Authentication

## Contributing

1. Follow TypeScript strict mode
2. Use Effect.ts for business logic
3. Add tests for new features
4. Run linting and formatting before commits

## License

MIT