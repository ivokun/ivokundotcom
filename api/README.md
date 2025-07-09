# API Documentation

This is a Strapi 5 API for a content management system that powers a blog/portfolio website. The API provides content types for posts, categories, galleries, and home page content.

## Development Setup

### Prerequisites

- Node.js >= 22.17.0
- pnpm >= 9.5.0
- PostgreSQL database

### Environment Variables

Create a `.env` file in the `api/` directory with the following variables:

```bash
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/database_name

# Admin JWT Secret
ADMIN_JWT_SECRET=your-admin-jwt-secret

# JWT Secret
JWT_SECRET=your-jwt-secret

# API Token Salt
API_TOKEN_SALT=your-api-token-salt

# Transfer Token Salt
TRANSFER_TOKEN_SALT=your-transfer-token-salt

# Cloudflare R2 Storage (Optional)
R2_ACCESS_KEY_ID=your-r2-access-key
R2_ACCESS_SECRET=your-r2-secret-key
R2_ENDPOINT=https://your-account.r2.cloudflarestorage.com
R2_PUBLIC_URL=https://your-public-url.com
```

### Installation & Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm run develop

# Build for production
pnpm run build

# Start production server
pnpm run start
```

The API will be available at `http://localhost:1337` by default.

### Admin Panel

Access the Strapi admin panel at `http://localhost:1337/admin` to manage content types and data.

## API Structure

```mermaid
graph TB
    subgraph "Strapi 5 API"
        A[Strapi Core] --> B[Admin Panel]
        A --> C[REST API]
        A --> D[GraphQL API]
    end

    subgraph "Content Types"
        E[Post]
        F[Category] 
        G[Gallery]
        H[Home]
    end

    subgraph "Configuration"
        I[Database Config]
        J[Server Config]
        K[Plugins Config]
        L[Middleware Config]
    end

    subgraph "File Structure"
        M["/src/api/"]
        N["/config/"]
        O["/database/"]
        P["/public/"]
    end

    A --> E
    A --> F
    A --> G
    A --> H

    A --> I
    A --> J
    A --> K
    A --> L

    E --> |"1:N"| F
    F --> |"1:N"| G

    M --> E
    M --> F
    M --> G
    M --> H

    N --> I
    N --> J
    N --> K
    N --> L

    subgraph "Content Relationships"
        E --> |"Many-to-One"| F
        F --> |"One-to-Many"| E
        F --> |"One-to-Many"| G
    end

    subgraph "Plugins & Features"
        Q[Users & Permissions]
        R[Internationalization]
        S[Cloudflare R2 Upload]
        T[PostgreSQL Database]
    end

    A --> Q
    A --> R
    A --> S
    A --> T
```

## Content Types

### Post
- **Collection Type**: Blog posts with rich content
- **Features**: Draft/Publish, Internationalization
- **Fields**: 
  - `title` (String, localized)
  - `content` (Rich Text, localized)
  - `richContent` (Blocks, localized)
  - `featuredPicture` (Media)
  - `slug` (UID from title)
  - `excerpt` (String, localized)
  - `readTimeMinute` (Integer, localized)
  - `category` (Relation to Category)

### Category
- **Collection Type**: Content categorization
- **Features**: Draft/Publish
- **Fields**:
  - `name` (String)
  - `description` (Rich Text)
  - `slug` (UID from name)
  - `posts` (Relation to Posts)
  - `galleries` (Relation to Galleries)

### Gallery
- **Collection Type**: Image galleries
- **Features**: Draft/Publish, Internationalization
- **Fields**:
  - Media collections and metadata
  - `category` (Relation to Category)

### Home
- **Single Type**: Homepage content
- **Features**: Internationalization
- **Fields**: Homepage-specific content and layout

## File Structure

```
api/
├── config/                 # Configuration files
│   ├── admin.ts            # Admin panel configuration
│   ├── api.ts              # API configuration
│   ├── database.ts         # Database configuration
│   ├── middlewares.ts      # Middleware configuration
│   ├── plugins.ts          # Plugin configuration (R2 upload)
│   ├── server.ts           # Server configuration
│   └── env/                # Environment-specific configs
│       └── production/
├── database/               # Database files
│   └── migrations/         # Database migrations
├── src/
│   ├── admin/              # Admin customizations
│   │   └── tsconfig.json
│   ├── api/                # Content types
│   │   ├── category/       # Category content type
│   │   │   ├── content-types/
│   │   │   ├── controllers/
│   │   │   ├── routes/
│   │   │   └── services/
│   │   ├── gallery/        # Gallery content type
│   │   ├── home/           # Home content type
│   │   └── post/           # Post content type
│   ├── extensions/         # Core extensions
│   └── index.ts            # Main entry point
├── types/                  # TypeScript definitions
│   └── generated/          # Auto-generated types
├── public/                 # Static files
└── package.json           # Dependencies and scripts
```

## API Endpoints

### REST API Endpoints

- **Posts**: `/api/posts`
  - `GET /api/posts` - List all posts
  - `GET /api/posts/:id` - Get specific post
  - `POST /api/posts` - Create new post (authenticated)
  - `PUT /api/posts/:id` - Update post (authenticated)
  - `DELETE /api/posts/:id` - Delete post (authenticated)

- **Categories**: `/api/categories`
  - `GET /api/categories` - List all categories
  - `GET /api/categories/:id` - Get specific category

- **Galleries**: `/api/galleries`
  - `GET /api/galleries` - List all galleries
  - `GET /api/galleries/:id` - Get specific gallery

- **Home**: `/api/home`
  - `GET /api/home` - Get homepage content

### Authentication

The API uses JWT tokens for authentication. Admin users can access all endpoints, while public endpoints are available for read operations.

## Technologies

- **Backend**: Strapi 5.16.1
- **Database**: PostgreSQL
- **File Storage**: Cloudflare R2
- **Authentication**: JWT
- **Internationalization**: Built-in i18n support
- **TypeScript**: Full TypeScript support

## Development Notes

- Uses Strapi 5 Document Service API (Entity Service is deprecated)
- Configured for PostgreSQL with connection pooling
- Cloudflare R2 integration for media storage
- Internationalization enabled for content localization
- Custom content types follow Strapi 5 best practices