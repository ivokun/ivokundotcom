# Dockerfile - Bun version
FROM --platform=linux/amd64 oven/bun:1.1.38-slim AS base

FROM base AS build
ENV NODE_ENV=production

# Install libvips for sharp compatibility
RUN apt-get update && apt-get install -y libvips-dev && rm -rf /var/lib/apt/lists/*

COPY . /usr/src/app
WORKDIR /usr/src/app

# Install all dependencies (workspace aware)
RUN bun install --frozen-lockfile

# Build the api package
RUN bun --filter=api run build

# Create production directory with only necessary files
FROM base AS prod-prep
WORKDIR /prod/api

# Copy api package files
COPY --from=build /usr/src/app/api/package.json ./package.json
COPY --from=build /usr/src/app/api/dist ./dist
COPY --from=build /usr/src/app/api/public ./public
COPY --from=build /usr/src/app/api/config ./config
COPY --from=build /usr/src/app/api/database ./database
COPY --from=build /usr/src/app/api/src ./src

# Install only production dependencies for api package
RUN bun install --production --frozen-lockfile

# Final runtime image
FROM --platform=linux/amd64 oven/bun:1.1.38-slim
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1-x86_64 /lambda-adapter /opt/extensions/lambda-adapter

# Install libvips in final image
RUN apt-get update && apt-get install -y libvips && rm -rf /var/lib/apt/lists/*

COPY --from=prod-prep /prod/api /prod/api
WORKDIR /prod/api

ENV PORT=1337 NODE_ENV=production

EXPOSE 1337
CMD [ "bun", "start" ]
