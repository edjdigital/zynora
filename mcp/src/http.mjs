#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import http from "node:http";

import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { createZynoraMcpServer } from "./create-server.mjs";

const MCP_PATH = process.env.ZYNORA_MCP_HTTP_PATH ?? "/mcp";
const PORT = Number(process.env.ZYNORA_MCP_PORT ?? process.env.PORT ?? "3333");
const HOST = process.env.ZYNORA_MCP_HOST ?? "127.0.0.1";
const SESSION_TTL_MS = Number(process.env.ZYNORA_MCP_SESSION_TTL_MS ?? String(30 * 60 * 1000));
const BODY_LIMIT = Number(process.env.ZYNORA_MCP_BODY_LIMIT ?? String(2 * 1024 * 1024));
const JSON_RESPONSE_DEFAULT = process.env.ZYNORA_MCP_HTTP_JSON !== "0";

/**
 * @param {unknown} body
 * @returns {boolean}
 */
function bodyHasInitialize(body) {
    const messages = body === null || body === undefined ? [] : Array.isArray(body) ? body : [body];

    return messages.some((m) => isInitializeRequest(m));
}

/**
 * @param {import("node:http").IncomingMessage} req
 * @returns {Promise<unknown>}
 */
function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];

        let n = 0;

        req.on("data", (chunk) => {
            n += chunk.length;

            if (n > BODY_LIMIT) {
                reject(new Error("request body too large"));

                return;
            }

            chunks.push(chunk);
        });

        req.on("end", () => {
            if (chunks.length === 0) {
                resolve(undefined);

                return;
            }

            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
            } catch (e) {
                reject(e);
            }
        });

        req.on("error", reject);
    });
}

/** @type {Map<string, { server: object; transport: StreamableHTTPServerTransport; createdAt: number }>} */
const sessions = new Map();

/**
 * @param {import("node:http").IncomingMessage} req
 * @returns {string | undefined}
 */
function getSessionHeader(req) {
    const raw = req.headers["mcp-session-id"];

    return typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
}

/**
 * @returns {ConstructorParameters<typeof StreamableHTTPServerTransport>[0]}
 */
function transportOptions() {
    /** @type {ConstructorParameters<typeof StreamableHTTPServerTransport>[0]} */
    const opts = {
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: JSON_RESPONSE_DEFAULT
    };

    if (process.env.ZYNORA_MCP_DNS_REBINDING === "1") {
        const hosts = process.env.ZYNORA_MCP_ALLOWED_HOSTS?.split(",")
            .map((h) => h.trim())
            .filter(Boolean);
        const origins = process.env.ZYNORA_MCP_ALLOWED_ORIGINS?.split(",")
            .map((o) => o.trim())
            .filter(Boolean);

        opts.enableDnsRebindingProtection = true;

        if (hosts?.length) {
            opts.allowedHosts = hosts;
        }

        if (origins?.length) {
            opts.allowedOrigins = origins;
        }
    }

    return opts;
}

/**
 * @param {SessionEntry} entry
 */
function touchSession(entry) {
    entry.createdAt = Date.now();
}

setInterval(() => {
    const now = Date.now();

    for (const [id, entry] of sessions) {
        if (now - entry.createdAt > SESSION_TTL_MS) {
            entry.transport.close().catch(() => {});
            sessions.delete(id);
        }
    }
}, 60_000);

/**
 * @param {import("node:http").ServerResponse} res
 * @param {() => Promise<void>} next
 */
async function withCors(req, res, next) {
    const origin = process.env.ZYNORA_MCP_CORS_ORIGIN ?? "*";

    if (process.env.ZYNORA_MCP_CORS === "1") {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
    }

    if (process.env.ZYNORA_MCP_CORS === "1" && req.method === "OPTIONS") {
        res.writeHead(204, {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, mcp-session-id, mcp-protocol-version, Accept",
            "Access-Control-Max-Age": "86400"
        });
        res.end();

        return;
    }

    await next();
}

/**
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 */
async function handleMcp(req, res) {
    let parsedBody;

    if (req.method === "POST") {
        try {
            parsedBody = await readJsonBody(req);
        } catch {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "invalid_json_body" }));

            return;
        }
    }

    const sid = getSessionHeader(req);

    if (sid) {
        const entry = sessions.get(sid);

        if (!entry) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "unknown_mcp_session" }));

            return;
        }

        touchSession(entry);
        await entry.transport.handleRequest(req, res, parsedBody);

        return;
    }

    if (req.method === "GET" || req.method === "DELETE") {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "mcp_session_id_required" }));

        return;
    }

    if (req.method !== "POST" || !bodyHasInitialize(parsedBody)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "initialize_required_first_post" }));

        return;
    }

    const mcpServer = createZynoraMcpServer();
    const transport = new StreamableHTTPServerTransport({
        ...transportOptions(),
        onsessioninitialized: (id) => {
            sessions.set(id, {
                server: mcpServer,
                transport,
                createdAt: Date.now()
            });
        },
        onsessionclosed: (id) => {
            sessions.delete(id);
        }
    });

    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, parsedBody);
}

const httpServer = http.createServer(async (req, res) => {
    await withCors(req, res, async () => {
        try {
            const host = req.headers.host ?? "localhost";
            const url = new URL(req.url ?? "/", `http://${host}`);

            if (url.pathname === "/health") {
                res.writeHead(200, { "Content-Type": "text/plain" });
                res.end("ok");

                return;
            }

            if (url.pathname !== MCP_PATH) {
                res.writeHead(404, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "not_found" }));

                return;
            }

            await handleMcp(req, res);
        } catch (e) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "internal_error", message: String(e?.message ?? e) }));
        }
    });
});

httpServer.listen(PORT, HOST, () => {
    process.stderr.write(
        `zynora-mcp http listening on http://${HOST}:${PORT}${MCP_PATH} (jsonResponse=${JSON_RESPONSE_DEFAULT})\n`
    );
});
