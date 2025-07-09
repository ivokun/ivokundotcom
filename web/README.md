# Web Frontend Documentation

This is an Astro 5 frontend application that serves as a blog/portfolio website, consuming content from the Strapi 5 API. The application features a modern stack with React components, TailwindCSS styling, and TypeScript support.

## Development Setup

### Prerequisites

- Node.js >= 22.17.0
- pnpm >= 9.5.0
- Running Strapi API (see `../api/README.md`)

### Environment Variables

Create a `.env` file in the `web/` directory with the following variables:

```bash
# Strapi API Configuration
CMS_API_URL=http://localhost:1337/api
CMS_API_TOKEN=your-api-token

# Site Configuration
PUBLIC_GOOGLE_SITE_VERIFICATION=your-google-verification-code
```

### Installation & Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm run dev

# Build for production
pnpm run build

# Preview production build
pnpm run preview
```

The application will be available at `http://localhost:4321` by default.

## Web Architecture

```mermaid
graph TB
    subgraph "Frontend (Astro 5)"
        A[Astro Router] --> B[Pages]
        A --> C[Layouts]
        A --> D[Components]
        B --> E[Static Generation]
    end

    subgraph "Pages"
        F[Home /]
        G[Articles /articles]
        H[Article Detail /articles/[slug]]
        I[Gallery /gallery]
        J[Gallery Detail /gallery/[slug]]
        K[About /about-me]
    end

    subgraph "Components"
        L[Header.tsx]
        M[Navigation.astro]
        N[ArticleCard.astro]
        O[GalleryGrid.astro]
        P[FooterNav.tsx]
        Q[Hero.astro]
    end

    subgraph "Layouts"
        R[Layout.astro]
        S[NewLayout.astro]
    end

    subgraph "API Layer"
        T[article.ts]
        U[category.ts]
        V[gallery.ts]
        W[home.ts]
    end

    subgraph "External Services"
        X[Strapi 5 API]
        Y[Cloudflare R2]
        Z[Google Analytics]
    end

    A --> F
    A --> G
    A --> H
    A --> I
    A --> J
    A --> K

    B --> R
    B --> S

    D --> L
    D --> M
    D --> N
    D --> O
    D --> P
    D --> Q

    T --> X
    U --> X
    V --> X
    W --> X

    X --> Y
    B --> Z

    subgraph "Technologies"
        AA[Astro 5.10.1]
        BB[React 18]
        CC[TailwindCSS 3]
        DD[TypeScript 5.8]
        EE[Vite 5]
    end

    A --> AA
    D --> BB
    R --> CC
    T --> DD
    AA --> EE
```

## Project Structure

```
web/
├── public/                     # Static assets
│   ├── favicon.ico
│   └── ivokun_logo.png
├── src/
│   ├── api/                    # API client functions
│   │   ├── article.ts          # Article API calls and types
│   │   ├── category.ts         # Category API calls and types
│   │   ├── gallery.ts          # Gallery API calls and types
│   │   └── home.ts             # Home page API calls and types
│   ├── components/             # Reusable components
│   │   ├── ArticleCard.astro   # Article preview card
│   │   ├── FooterNav.tsx       # Footer navigation (React)
│   │   ├── GalleryGrid.astro   # Gallery grid layout
│   │   ├── Header.tsx          # Site header (React)
│   │   ├── Hero.astro          # Hero section
│   │   ├── HeroImage.astro     # Hero image component
│   │   ├── Navigation.astro    # Main navigation
│   │   └── Welcome.astro       # Welcome section
│   ├── layouts/                # Page layouts
│   │   ├── Layout.astro        # Base layout with SEO
│   │   └── NewLayout.astro     # Alternative layout
│   ├── pages/                  # Route pages
│   │   ├── index.astro         # Homepage
│   │   ├── about-me.astro      # About page
│   │   ├── about.astro         # Alternative about page
│   │   ├── articles.astro      # Articles listing
│   │   ├── articles/
│   │   │   └── [slug].astro    # Dynamic article pages
│   │   ├── gallery.astro       # Gallery listing
│   │   └── gallery/
│   │       └── [slug].astro    # Dynamic gallery pages
│   └── env.d.ts                # Environment type definitions
├── astro.config.mjs            # Astro configuration
├── tailwind.config.cjs         # TailwindCSS configuration
├── tsconfig.json               # TypeScript configuration
└── package.json                # Dependencies and scripts
```

## Key Features

### Static Site Generation (SSG)
- Pre-rendered pages for optimal performance
- Dynamic routes for articles and galleries
- SEO-optimized with meta tags and Open Graph

### Content Management
- **Articles**: Blog posts with rich content, categories, and featured images
- **Galleries**: Image collections with categorization
- **Homepage**: Dynamic homepage content from Strapi
- **About**: Static and dynamic about pages

### Component Architecture
- **Astro Components**: Server-side rendered (.astro files)
- **React Components**: Interactive UI elements (.tsx files)
- **Hybrid Approach**: Mix of static and interactive components

### Styling & Design
- **TailwindCSS**: Utility-first CSS framework
- **Responsive Design**: Mobile-first approach
- **Custom Styling**: Global styles in Layout.astro

## API Integration

### Type Safety
All API responses are typed using TypeBox schemas:

```typescript
// Example from article.ts
const ArticleSchema = Type.Object({
  id: Type.Integer(),
  attributes: Type.Object({
    title: Type.String(),
    content: Type.String(),
    slug: Type.String(),
    // ... more fields
  })
});
```

### API Functions
- **Fetch with Authentication**: Bearer token authentication
- **Error Handling**: Proper error handling for API calls
- **Data Transformation**: Clean data transformation from Strapi format

### Content Types Integration
- **Posts/Articles**: Full CRUD operations via Strapi API
- **Categories**: Hierarchical content organization
- **Media**: Cloudflare R2 integration for images
- **Internationalization**: Multi-language support

## Pages Overview

### Homepage (`/`)
- Dynamic content from Strapi Home content type
- Hero section with navigation
- Welcome section with parsed markdown content

### Articles (`/articles`)
- Listing of all published articles
- Category filtering
- Pagination support
- SEO optimized article cards

### Article Detail (`/articles/[slug]`)
- Dynamic routes based on article slugs
- Full article content with rich text rendering
- Featured images and metadata
- Related articles

### Gallery (`/gallery` & `/gallery/[slug]`)
- Image gallery listings and detail views
- Category-based organization
- Responsive image grids
- Lightbox functionality

### About (`/about-me`)
- Static about page
- Personal information and bio
- Contact information

## Development Workflow

### Adding New Pages
1. Create `.astro` file in `src/pages/`
2. Use existing layouts from `src/layouts/`
3. Import and use components from `src/components/`
4. Add API calls if needed from `src/api/`

### Adding New Components
1. Create component in `src/components/`
2. Use `.astro` for server-side components
3. Use `.tsx` for interactive React components
4. Import and use in pages or other components

### Styling Guidelines
- Use TailwindCSS utility classes
- Follow mobile-first responsive design
- Global styles in `Layout.astro`
- Component-specific styles in component files

## Technologies

- **Framework**: Astro 5.10.1
- **UI Library**: React 18.0.0
- **Styling**: TailwindCSS 3.0.24
- **Language**: TypeScript 5.8.3
- **Build Tool**: Vite 5.x
- **Package Manager**: pnpm
- **Content Source**: Strapi 5 API
- **Deployment**: Static site generation

## Performance Features

- **Static Generation**: Pre-built pages for fast loading
- **Image Optimization**: Astro's built-in image optimization
- **CSS Purging**: TailwindCSS removes unused styles
- **Component Islands**: Selective hydration for React components
- **Bundle Splitting**: Automatic code splitting

## SEO & Analytics

- **Meta Tags**: Dynamic meta tags for each page
- **Open Graph**: Social media sharing optimization
- **Canonical URLs**: Proper canonical URL handling
- **Google Analytics**: Integrated analytics tracking
- **Site Verification**: Google Search Console integration

## Development Notes

- Uses Astro's Islands Architecture for optimal performance
- React components are hydrated only when needed
- TypeScript strict mode enabled for type safety
- Hot module reloading in development
- Production builds are statically generated
- Tailwind JIT mode for faster development builds