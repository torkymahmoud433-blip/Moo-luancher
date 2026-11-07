FROM --platform=linux/arm64 node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends docker.io adb ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src
RUN mkdir -p /tmp/moo-uploads

# The API needs Docker socket access to manage the Android container.
# Keep this service private behind an HTTPS reverse proxy.
USER root

EXPOSE 8080
CMD ["npm","start"]
