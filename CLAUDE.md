# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build/Lint/Test Commands

- Root: `pnpm typecheck` - TypeScript type checking
- Root: `pnpm dev` - Start SST development environment
- Root: `pnpm build` - Build all services
- Web: `pnpm -F web dev` - Start Astro dev server for web
- API: `pnpm -F api develop` - Start Strapi development server

## Code Style Guidelines

- **Formatting**: Use Prettier for consistent formatting
- **Imports**: Use `simple-import-sort` plugin rules - imports must be sorted
- **TypeScript**: Strict typing preferred in web/ and project/, follows Node18 tsconfig standards
- **API**: Uses JavaScript (not TypeScript) following Strapi conventions
- **Component Structure**: Follow Astro component patterns in web/
- **API Structure**: Follow Strapi conventions in api/ directory
- **Error Handling**: Use appropriate try/catch blocks with typed errors
- **Naming**: Use camelCase for variables/functions, PascalCase for components/types
- **React Components**: Used within Astro components where interactive UI is needed
- **File Structure**: Follow existing patterns in respective directories
