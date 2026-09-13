# The Graph Model Context Protocol (MCP) Server Suite

Dual Model Context Protocol (MCP) servers (`subgraph_read` and `subgraph_write`) built with `@modelcontextprotocol/sdk` enabling autonomous AI agents (Hermes, Claude Desktop, Cursor, ChatGPT) to query indexed blockchain data and autonomously manage Subgraph deployments on **The Graph Studio**.

---

## 🏛️ Architecture & Safety Model

To enforce the principle of least privilege, the suite is strictly separated into two distinct MCP servers with separate security profiles:

```
                            ┌──────────────────────────────────────────────┐
                            │    Autonomous AI Agent (Hermes / LLM)        │
                            └──────────────────────┬───────────────────────┘
                                                   │
                 ┌─────────────────────────────────┴─────────────────────────────────┐
                 │ (Model Context Protocol - Stdio)                                  │ (Model Context Protocol - Stdio)
                 ▼                                                                   ▼
┌──────────────────────────────────────────────┐    ┌──────────────────────────────────────────────┐
│        subgraph_read (Read-Only)             │    │        subgraph_write (Privileged)           │
│                                              │    │                                              │
│ • Safe for public & query-only profiles      │    │ • Requires GRAPH_DEPLOY_KEY secret           │
│ • No child process execution permissions     │    │ • Mutates subgraph.yaml & builds artifacts   │
│ • Queries live Graph Studio GraphQL endpoint │    │ • Deploys & verifies live propagation        │
│ • Enforces indexing health & freshness       │    │ • Reports deployment status via _meta        │
└──────────────────────┬───────────────────────┘    └──────────────────────┬───────────────────────┘
                       │ (GraphQL Queries)                                 │ (Graph CLI Deploy & Verify)
                       ▼                                                   ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               The Graph Studio (Sepolia Subgraph)                                │
│                         Entities: Token  •  Account  •  Transfer                                 │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Safety & Security Separation
* **`subgraph_read`**: Deliberately contains **zero** child process imports (`node:child_process` is never imported). It only issues read-only GraphQL HTTP requests to `SUBGRAPH_URL`. Safe for public agent profiles and general user queries.
* **`subgraph_write`**: Requires the privileged `GRAPH_DEPLOY_KEY`. It modifies `subgraph.yaml`, executes `graph codegen`, `graph build`, and `graph deploy`, and validates on-chain indexing propagation. **Never register `subgraph_write` in public or unauthenticated agent contexts.**

---

## 📋 Prerequisites

* **Node.js**: `v20.x` or higher
* **npm**: `v10.x` or higher
* **Graph CLI**: `@graphprotocol/graph-cli` installed locally (`npm install` in `apps/agent/mcps/subgraph/subgraph`)
* **Ethereum Sepolia RPC**: (e.g. `https://ethereum-sepolia-rpc.publicnode.com`)

---

## ⚙️ Environment Variables

| Variable | Required In | Description |
| :--- | :--- | :--- |
| `SUBGRAPH_URL` | `subgraph_read`, `subgraph_write` | The query endpoint on Graph Studio. **Must use the `/version/latest` path segment** (e.g. `https://api.studio.thegraph.com/query/<ID>/<SUBGRAPH_SLUG>/version/latest`) so it dynamically resolves across redeployments. |
| `GRAPH_DEPLOY_KEY` | `subgraph_write` only | Deployment key obtained from your Subgraph dashboard in Graph Studio. Keep secret. |
| `SEPOLIA_RPC_URL` | Optional | Ethereum Sepolia JSON-RPC URL for direct block queries (defaults to public node). |
| `SUBGRAPH_DIR` | Optional | Path to the subgraph directory containing `subgraph.yaml` (defaults to `../subgraph`). |

---

## 🚀 Installation & Running

### 1. Install Dependencies
```bash
cd apps/agent/mcps/subgraph/mcp-server
npm install
npm run build
```

### 2. Start Servers Directly (Stdio Transport)

**Read-only Server:**
```bash
SUBGRAPH_URL="https://api.studio.thegraph.com/query/12345/prism8-rwa/version/latest" \
node dist/read.js
```

**Write / Deploy Server:**
```bash
SUBGRAPH_URL="https://api.studio.thegraph.com/query/12345/prism8-rwa/version/latest" \
GRAPH_DEPLOY_KEY="your_graph_deploy_key" \
node dist/write.js
```

---

## 🔌 Integration Configurations

### Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "thegraph-read": {
      "command": "node",
      "args": ["/absolute/path/to/apps/agent/mcps/subgraph/mcp-server/dist/read.js"],
      "env": {
        "SUBGRAPH_URL": "https://api.studio.thegraph.com/query/12345/prism8-rwa/version/latest"
      }
    },
    "thegraph-write": {
      "command": "node",
      "args": ["/absolute/path/to/apps/agent/mcps/subgraph/mcp-server/dist/write.js"],
      "env": {
        "SUBGRAPH_URL": "https://api.studio.thegraph.com/query/12345/prism8-rwa/version/latest",
        "GRAPH_DEPLOY_KEY": "your_deploy_key"
      }
    }
  }
}
```

### Cursor IDE (`.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "thegraph_reader": {
      "command": "node",
      "args": ["./apps/agent/mcps/subgraph/mcp-server/dist/read.js"],
      "env": {
        "SUBGRAPH_URL": "https://api.studio.thegraph.com/query/12345/prism8-rwa/version/latest"
      }
    }
  }
}
```

### Hermes Agent (`apps/agent/server.py`)
Hermes automatically loads these servers in its configuration pipeline based on the active role (`operator` vs `public_reader`).

---

## 🛠️ Tool Reference

### `subgraph_read` Tools

| Tool Name | Parameters | Description & Output |
| :--- | :--- | :--- |
| `get_token_info` | `tokenAddress?: string` | Returns indexed token name, symbol, decimals, and total indexed transfer count. |
| `get_top_holders` | `tokenAddress?: string`, `limit?: number (1-100, default 10)` | Returns accounts ranked by descending token balance with transfer counts. |
| `get_recent_transfers`| `tokenAddress?: string`, `limit?: number (1-100, default 20)` | Returns latest ERC-20 transfers (from, to, value, timestamp, txHash). |
| `get_account_balance` | `address: string`, `tokenAddress?: string` | Returns exact indexed token balance for a specified address. |
| `get_biggest_transfer`| `tokenAddress?: string`, `excludeMintBurn?: boolean (default true)` | Finds the highest-value token transfer in the index. |
| `get_latest_sepolia_block` | *none* | Direct Sepolia JSON-RPC call returning current canonical block height. |
| `get_tracked_tokens` | *none* | Reads local `subgraph.yaml` configuration to list all declared data sources. |
| `get_deployment_status` | *none* | Compares local config against Graph Studio live `_meta` (IPFS hash, block, errors). |

### `subgraph_write` Tools

| Tool Name | Parameters | Description & Behavior |
| :--- | :--- | :--- |
| `add_token_source` | `address: string`, `startBlock: number`, `name?: string` | Appends a new ERC-20 contract to `subgraph.yaml`, runs `graph codegen`, `graph build`, and `graph deploy`, then polls `_meta` to verify propagation. |
| `set_token_sources` | `tokens: Array<{ address, startBlock, name? }>` | Replaces the tracked token registry with the provided set and redeploys to Studio. |

---

## 📖 Live Graph Studio Setup Guide

1. Navigate to [The Graph Studio](https://thegraph.com/studio/) and connect your wallet.
2. Click **Create a Subgraph**, name it `prism8-rwa`, and select **Ethereum Sepolia**.
3. Copy your **Deploy Key** from the right sidebar.
4. Copy the **Query URL** and ensure it ends with `/version/latest`:
   ```
   https://api.studio.thegraph.com/query/<ACCOUNT_ID>/prism8-rwa/version/latest
   ```
5. Set the environment variables in your `.env.local` or MCP configuration:
   ```ini
   SUBGRAPH_URL="https://api.studio.thegraph.com/query/<ACCOUNT_ID>/prism8-rwa/version/latest"
   GRAPH_DEPLOY_KEY="<YOUR_DEPLOY_KEY>"
   ```

---

## 🤖 Example Natural-Language Agent Workflow

```
User: "How should we distribute $3,800 monthly rental yield for the property token at 0x71C840...?"

Hermes Agent:
1. Calls `subgraph_read.get_deployment_status()`
   -> Confirms Subgraph is healthy (hasIndexingErrors: false, block: 11350480).
2. Calls `subgraph_read.get_top_holders(tokenAddress: "0x71C840...")`
   -> Holder 0x742d... holds 400.00 tokens (40.00% share).
   -> Holder 0x28a8... holds 350.00 tokens (35.00% share).
   -> Holder 0x3A97... holds 250.00 tokens (25.00% share).
3. Calculates Per-Second Flow Rates:
   -> 0x742d...: $1,520.00/mo -> +$0.000586419/sec
   -> 0x28a8...: $1,330.00/mo -> +$0.000513117/sec
   -> 0x3A97...: $950.00/mo   -> +$0.000366512/sec
4. Opens Superfluid CFA cashflow streams in YieldVault.sol and records HCS audit receipt.
```
