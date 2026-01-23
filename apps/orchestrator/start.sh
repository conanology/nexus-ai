#!/bin/sh
# Entrypoint script for orchestrator with Node.js module resolution flags
exec node --experimental-specifier-resolution=node apps/orchestrator/dist/index.js
