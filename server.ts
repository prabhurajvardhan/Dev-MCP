/**
 * HTTP preview server for port 3000 in AI Studio environment
 */
import express from 'express';

const app = express();
const port = 3000;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    server: 'vibe-engineering-mcp',
    transport: 'stdio',
    version: '0.1.0',
  });
});

app.get('/', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Vibe Engineering MCP</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #09090b; color: #f4f4f5; margin: 0; padding: 2.5rem; line-height: 1.5; }
    h1 { color: #10b981; font-size: 1.75rem; margin-bottom: 0.25rem; font-weight: 600; }
    p { color: #a1a1aa; font-size: 0.95rem; margin-top: 0.25rem; }
    .badge { display: inline-block; background: #064e3b; color: #34d399; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-family: monospace; font-weight: 600; margin-bottom: 1rem; border: 1px solid #047857; }
    .card { background: #18181b; border: 1px solid #27272a; border-radius: 0.75rem; padding: 1.5rem; margin-top: 1.5rem; }
    code { font-family: ui-monospace, monospace; color: #38bdf8; background: #09090b; padding: 0.2rem 0.4rem; border-radius: 0.25rem; font-size: 0.85rem; border: 1px solid #27272a; }
    ul { margin: 0.5rem 0 0; padding-left: 1.25rem; color: #d4d4d8; font-size: 0.9rem; }
    li { margin-bottom: 0.25rem; }
  </style>
</head>
<body>
  <div class="badge">V0.1.0 CONTROL PLANE ACTIVE</div>
  <h1>VIBE ENGINEERING MCP</h1>
  <p>An agentic software-engineering control plane that manages requirements, architecture, tasks, workspaces, execution, verification, integration, and checkpoints.</p>

  <div class="card">
    <h3 style="margin-top:0; color:#fafafa;">MCP Stdio Server</h3>
    <p>Launch the stdio server for Claude Code, Cursor, or any MCP client:</p>
    <code>npm run mcp</code> or <code>npx tsx src/server/index.ts</code>
  </div>

  <div class="card">
    <h3 style="margin-top:0; color:#fafafa;">Verification & Testing</h3>
    <p>Run the comprehensive test suite (unit + real MCP client stdio integration):</p>
    <code>npm test</code>
  </div>
</body>
</html>`);
});

app.listen(port, '0.0.0.0', () => {
  console.error(`[Vibe MCP Server] HTTP preview running on port ${port}`);
});
