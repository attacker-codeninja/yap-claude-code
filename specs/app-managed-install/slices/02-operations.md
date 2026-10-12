# 02 Operations (done, uncommitted)

**Contract.** `cli.status`, `cli.install`, `cli.uninstall` are public, synchronous,
take `{}`, and are forwarded to the native control channel; with no app connected
the service returns `CLI_UNAVAILABLE`.

**Seams.** `packages/protocol/src/operations.ts`, `apps/service/src/project-service.ts`.
CLI help and MCP tools derive from `operationNames`.

**Tests.** protocol (46), `apps/service/src/project-service.test.ts` (38), `apps/cli/src/main.test.ts` (26).
