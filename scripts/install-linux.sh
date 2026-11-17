#!/usr/bin/env bash
# Instalador portátil de Axiom Engine para Linux.
# Uso: ./install-linux.sh [version]
set -euo pipefail

REPO="otaplus/axiom-engine"
DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
APPLICATIONS_DIR="$DATA_HOME/applications"
INSTALL_DIR="$DATA_HOME/axiom-engine"
VERSION="${1:-latest}"

command -v curl >/dev/null 2>&1 || { echo "Se necesita curl."; exit 1; }
command -v tar >/dev/null 2>&1 || { echo "Se necesita tar."; exit 1; }

if [ "$VERSION" = "latest" ]; then
  VERSION="$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | sed -n 's/.*"tag_name": *"v\{0,1\}\([^"]*\)".*/\1/p' | head -n 1)"
fi

if [ -z "$VERSION" ]; then
  echo "No se pudo determinar la última versión."
  exit 1
fi

ARCH="$(uname -m)"
if [ "$ARCH" != "x86_64" ] && [ "$ARCH" != "amd64" ]; then
  echo "Axiom Engine solo distribuye binarios Linux x86_64 por ahora."
  exit 1
fi

URL="https://github.com/$REPO/releases/download/v$VERSION/Axiom-Engine-$VERSION-x64.tar.gz"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Descargando Axiom Engine $VERSION…"
curl -fL "$URL" -o "$TMP/axiom.tar.gz"

echo "Instalando en $INSTALL_DIR…"
mkdir -p "$TMP/unpacked" "$DATA_HOME" "$APPLICATIONS_DIR"
tar -xzf "$TMP/axiom.tar.gz" -C "$TMP/unpacked"
SRC="$TMP/unpacked"
if [ ! -f "$SRC/axiom-engine" ]; then
  EXECUTABLE="$(find "$SRC" -maxdepth 3 -type f -name axiom-engine | head -n 1)"
  if [ -n "$EXECUTABLE" ]; then
    SRC="$(dirname "$EXECUTABLE")"
  fi
fi
if [ ! -f "$SRC/axiom-engine" ]; then
  echo "No se encontró el ejecutable axiom-engine en el paquete."
  exit 1
fi
rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
cp -a "$SRC"/. "$INSTALL_DIR"/
chmod +x "$INSTALL_DIR/axiom-engine"

if [ -f "$INSTALL_DIR/resources/icon.png" ]; then
  ICON="$INSTALL_DIR/resources/icon.png"
else
  ICON="utilities-terminal"
fi

cat > "$APPLICATIONS_DIR/axiom-engine.desktop" <<EOF
[Desktop Entry]
Name=Axiom Engine
Comment=Motor de videojuegos 2D con Copiloto IA
Exec=$INSTALL_DIR/axiom-engine %U
Icon=$ICON
Terminal=false
Type=Application
Categories=Development;Game;
StartupWMClass=axiom-engine
EOF

chmod +x "$APPLICATIONS_DIR/axiom-engine.desktop"

mkdir -p "$HOME/.local/bin"
ln -sfn "$INSTALL_DIR/axiom-engine" "$HOME/.local/bin/axiom-engine"

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$APPLICATIONS_DIR" >/dev/null 2>&1 || true
fi

echo ""
echo "Axiom Engine $VERSION instalado."
echo "Ejecuta: axiom-engine"
echo "O búscalo como Axiom Engine en el menú de aplicaciones."
