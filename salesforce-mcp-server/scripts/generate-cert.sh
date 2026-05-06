#!/usr/bin/env bash
# Generates the RSA key pair required for Salesforce JWT Bearer authentication.
#
# Outputs (in the project root):
#   server.key  — RSA 2048-bit private key  (KEEP SECRET — never commit)
#   server.crt  — Self-signed X.509 certificate (upload to Salesforce Connected App)
#
# Usage:
#   chmod +x scripts/generate-cert.sh
#   ./scripts/generate-cert.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

KEY_FILE="${PROJECT_ROOT}/server.key"
CRT_FILE="${PROJECT_ROOT}/server.crt"

if [[ -f "${KEY_FILE}" ]]; then
  echo "WARNING: ${KEY_FILE} already exists. Delete it first if you want to regenerate."
  exit 1
fi

echo "Generating 2048-bit RSA private key..."
openssl genrsa -out "${KEY_FILE}" 2048

echo "Generating self-signed certificate (valid 10 years)..."
openssl req -new -x509 \
  -key "${KEY_FILE}" \
  -out "${CRT_FILE}" \
  -days 3650 \
  -subj "/C=US/ST=CA/O=SF MCP Server/CN=salesforce-mcp-jwt"

echo ""
echo "Done."
echo "  Private key:  ${KEY_FILE}"
echo "  Certificate:  ${CRT_FILE}"
echo ""
echo "Next steps:"
echo "  1. Upload ${CRT_FILE} to your Salesforce Connected App"
echo "     (Setup > App Manager > <your app> > Edit > Digital Signature > Upload)"
echo "  2. Keep ${KEY_FILE} secret — it is listed in .gitignore"
