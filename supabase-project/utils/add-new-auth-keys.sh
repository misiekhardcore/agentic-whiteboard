#!/bin/sh
#
# Generate the new-format API key configuration for this stack:
#
#   JWT_KEYS                        EC P-256 private + legacy symmetric signing JWKs
#   JWT_JWKS                        EC public + legacy symmetric verification JWKS
#   ANON_KEY_ASYMMETRIC             internal ES256 JWT, role=anon
#   SERVICE_ROLE_KEY_ASYMMETRIC     internal ES256 JWT, role=service_role
#   SUPABASE_PUBLISHABLE_KEY        sb_publishable_<22 chars>_<8 chars>
#   SUPABASE_SECRET_KEY             sb_secret_<22 chars>_<8 chars>
#
# Reads JWT_SECRET (and the existing legacy keys) from .env, so the symmetric
# key stays valid inside the JWKS and legacy clients keep working.
#
# Usage:
#   sh utils/add-new-auth-keys.sh               # print keys, ask before writing
#   sh utils/add-new-auth-keys.sh --update-env  # write straight to .env
#
# Restart the gateway and services afterwards:
#   docker compose up -d --force-recreate api-gw rest storage
#
set -e

cd "$(dirname "$0")/.."

if ! command -v node >/dev/null 2>&1; then
    echo "Error: node (>= 16) is required." >&2
    exit 1
fi

if [ ! -f .env ]; then
    echo "Error: .env not found in $(pwd)" >&2
    exit 1
fi

jwt_secret=$(grep '^JWT_SECRET=' .env | head -n1 | cut -d= -f2- | tr -d '\r"')
if [ -z "$jwt_secret" ]; then
    echo "Error: JWT_SECRET not found in .env" >&2
    exit 1
fi

tmpfile=$(mktemp)
trap 'rm -f "$tmpfile"' EXIT

node -e '
const crypto = require("crypto");
const jwtSecret = process.argv[1];

// EC P-256 signing pair.
const { privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
const jwk = privateKey.export({ format: "jwk" });
const kid = crypto.randomUUID();

// The legacy symmetric secret travels inside the JWKS so HS256 tokens still verify.
const octKey = { kty: "oct", k: Buffer.from(jwtSecret).toString("base64url"), alg: "HS256" };

const signingKeys = { keys: [
  { kty: "EC", kid, use: "sig", key_ops: ["sign", "verify"], alg: "ES256", ext: true,
    crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d },
  octKey,
] };
const publicJwks = { keys: [
  { kty: "EC", kid, use: "sig", key_ops: ["verify"], alg: "ES256", ext: true,
    crv: jwk.crv, x: jwk.x, y: jwk.y },
  octKey,
] };

function signEs256(payload) {
  const header = { alg: "ES256", typ: "JWT", kid };
  const data =
    Buffer.from(JSON.stringify(header)).toString("base64url") + "." +
    Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .sign("SHA256", Buffer.from(data), { key: privateKey, dsaEncoding: "ieee-p1363" })
    .toString("base64url");
  return data + "." + sig;
}

const iat = Math.floor(Date.now() / 1000);
const exp = iat + 5 * 365 * 24 * 3600;
const anonJwt = signEs256({ role: "anon", iss: "supabase", iat, exp });
const serviceJwt = signEs256({ role: "service_role", iss: "supabase", iat, exp });

// Same shape as the hosted platform: prefix + 22 random chars + "_" + 8-char checksum.
function opaqueKey(prefix) {
  const random = crypto.randomBytes(17).toString("base64url").slice(0, 22);
  const intermediate = prefix + random;
  const checksum = crypto
    .createHash("sha256")
    .update("supabase-self-hosted|" + intermediate)
    .digest("base64url")
    .slice(0, 8);
  return intermediate + "_" + checksum;
}

const vars = {
  SUPABASE_PUBLISHABLE_KEY: opaqueKey("sb_publishable_"),
  SUPABASE_SECRET_KEY: opaqueKey("sb_secret_"),
  ANON_KEY_ASYMMETRIC: anonJwt,
  SERVICE_ROLE_KEY_ASYMMETRIC: serviceJwt,
  JWT_KEYS: JSON.stringify(signingKeys.keys),
  JWT_JWKS: JSON.stringify(publicJwks),
};

for (const [name, value] of Object.entries(vars)) {
  console.log(name + "=" + value);
}
' "$jwt_secret" > "$tmpfile"

publishable=$(grep '^SUPABASE_PUBLISHABLE_KEY=' "$tmpfile" | cut -d= -f2-)

echo "Generated:"
echo "  SUPABASE_PUBLISHABLE_KEY=${publishable}"
echo "  SUPABASE_SECRET_KEY=<written below>"
echo "  ANON_KEY_ASYMMETRIC / SERVICE_ROLE_KEY_ASYMMETRIC=<ES256 JWTs>"
echo "  JWT_KEYS / JWT_JWKS=<EC P-256 + symmetric JWKS>"
echo ""

if [ "$1" = "--update-env" ]; then
    update_env=true
elif [ -t 0 ]; then
    printf "Update .env in place? (y/N) "
    read -r REPLY
    case "$REPLY" in
    [Yy]) update_env=true ;;
    *) update_env=false ;;
    esac
else
    echo "Non-interactive: pass --update-env to write the values to .env."
    update_env=false
fi

if [ "$update_env" != "true" ]; then
    exit 0
fi

cp .env .env.bak
while IFS= read -r line; do
    var=${line%%=*}
    value=${line#*=}
    if grep -q "^${var}=" .env; then
        # Rewrite in place; ENVIRON keeps awk from interpreting escapes in JWTs.
        KEY_VAR="$var" VALUE="$value" awk '
            BEGIN { prefix = ENVIRON["KEY_VAR"] "=" }
            index($0, prefix) == 1 { print prefix ENVIRON["VALUE"]; next }
            { print }
        ' .env > .env.next
        mv .env.next .env
    else
        printf '%s\n' "$line" >> .env
    fi
done < "$tmpfile"

if cmp -s .env .env.bak; then
    rm -f .env.bak
else
    echo "Backup of the previous configuration: .env.bak"
fi
echo "Updated .env with the new API key configuration."
echo "Restart the gateway and services: docker compose up -d --force-recreate api-gw rest storage"
