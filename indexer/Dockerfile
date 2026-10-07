FROM node:24.21.0-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global pnpm@12.9.1

WORKDIR /workspace/indexer
ENTRYPOINT ["pnpm"]
CMD ["start"]
