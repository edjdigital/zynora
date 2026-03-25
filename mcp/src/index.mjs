#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createZynoraMcpServer } from "./create-server.mjs";

const server = createZynoraMcpServer();
const transport = new StdioServerTransport();

await server.connect(transport);
