# Model Context Protocol (Streamable HTTP) for Zynora.
# Build from the zynora package root:
#   docker build -f mcp/Dockerfile -t zynora-mcp .

FROM node:22-bookworm-slim

WORKDIR /app

COPY mcp/package.json mcp/package-lock.json ./

RUN npm install --omit=dev

COPY mcp/src ./src

ENV NODE_ENV=production
ENV ZYNORA_MCP_HOST=0.0.0.0
ENV ZYNORA_ICONS_URL=https://zynora.even7.dev/zynora-icons.json

EXPOSE 3333

CMD ["node", "./src/http.mjs"]
