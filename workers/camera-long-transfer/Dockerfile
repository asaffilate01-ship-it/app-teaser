# Build context: repository root. Do not pass secrets to docker build.
FROM node:24-bookworm-slim
WORKDIR /opt/criclume
ENV NODE_ENV=production
COPY workers/camera-long-transfer/package.json workers/camera-long-transfer/package-lock.json ./workers/camera-long-transfer/
RUN cd workers/camera-long-transfer && npm ci --omit=dev --ignore-scripts
COPY workers/camera-long-transfer/index.mjs ./workers/camera-long-transfer/index.mjs
COPY src/lib/camera-import-policy.ts src/lib/camera-archive-policy.ts src/lib/camera-long-transfer-policy.ts ./src/lib/
USER node
CMD ["node", "workers/camera-long-transfer/index.mjs"]
