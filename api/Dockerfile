# Dockerfile
FROM --platform=linux/amd64 public.ecr.aws/docker/library/node:16.16.0-slim as builder
# Installing libvips-dev for sharp Compatability
RUN apt-get update && apt-get install libvips-dev -y
# Set environment to production
ENV NODE_ENV=production
# Copy the configuration files
WORKDIR /opt/
COPY ./package.json ./yarn.lock ./
ENV PATH /opt/node_modules/.bin:$PATH
# Install dependencies
RUN yarn install --production
# Copy the application files
WORKDIR /opt/app
COPY ./ .
# Build the Strapi application
RUN yarn build



FROM --platform=linux/amd64 public.ecr.aws/docker/library/node:16.16.0-slim as runner
# Installing libvips-dev for sharp Compatability
RUN apt-get update && apt-get install libvips-dev -y
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.6.0 /lambda-adapter /opt/extensions/lambda-adapter
ENV PORT=1337 NODE_ENV=production
WORKDIR /app
COPY --from=builder /opt/node_modules ./node_modules
COPY --from=builder /opt/app .
COPY --from=builder /opt/package.json ./package.json

EXPOSE 1337
# Start the Strapi application 
CMD ["yarn", "start"]
