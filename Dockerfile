FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates fontconfig fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build --chown=node:node /app ./

ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  PORT=3000

USER node
EXPOSE 3000

ENTRYPOINT ["node"]
CMD ["node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
