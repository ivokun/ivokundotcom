# Dockerfile
FROM --platform=linux/amd64 public.ecr.aws/docker/library/node:18-slim as base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV COREPACK_ENABLE_AUTO_PIN=0
RUN corepack enable pnpm

FROM base AS build
ENV NODE_ENV=production
# # Installing libvips for sharp Compatability
RUN apt-get update && apt-get install libvips -y
COPY . /usr/src/app
WORKDIR /usr/src/app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm --filter=api run build
RUN pnpm deploy --filter=api --prod /prod/api

FROM --platform=linux/amd64 base
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.8.1-x86_64 /lambda-adapter /opt/extensions/lambda-adapter
COPY --from=build /prod/api /prod/api
WORKDIR /prod/api
ENV PORT=1337 NODE_ENV=production

EXPOSE 1337
CMD [ "pnpm", "start" ]
