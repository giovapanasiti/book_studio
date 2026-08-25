#!/bin/bash
# Build Book Studio release artifacts.
#
#   scripts/release.sh linux     -> dist/book-studio_<v>_linux_amd64.tar.gz
#   scripts/release.sh deb       -> dist/book-studio_<v>_amd64.deb
#   scripts/release.sh windows   -> dist/book-studio_<v>_windows_amd64.zip
#   scripts/release.sh all       -> all of the above
#
# macOS cannot be cross-compiled from Linux: the GitHub Actions workflow
# (.github/workflows/release.yml) builds it on a macOS runner and uploads
# it to the release. Publish with: make publish
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION=$(sed -n 's/^pkgver=//p' PKGBUILD)
DIST=dist
mkdir -p "$DIST"

build_linux_binary() {
  wails build -tags webkit2_41
}

target_linux() {
  build_linux_binary
  local stage
  stage=$(mktemp -d)
  install -Dm755 build/bin/book-studio "$stage/book-studio/book-studio"
  install -Dm644 build/linux/book-studio.desktop "$stage/book-studio/book-studio.desktop"
  install -Dm644 build/appicon.png "$stage/book-studio/book-studio.png"
  cat > "$stage/book-studio/INSTALL" <<'EOF'
Book Studio, Linux x86_64.

Needs webkit2gtk-4.1 and gtk3 from your distribution.

  install -Dm755 book-studio ~/.local/bin/book-studio
  install -Dm644 book-studio.png ~/.local/share/icons/hicolor/512x512/apps/book-studio.png
  install -Dm644 book-studio.desktop ~/.local/share/applications/book-studio.desktop
EOF
  tar -C "$stage" --owner=0 --group=0 -czf "$DIST/book-studio_${VERSION}_linux_amd64.tar.gz" book-studio
  rm -rf "$stage"
  echo "built: $DIST/book-studio_${VERSION}_linux_amd64.tar.gz"
}

target_deb() {
  build_linux_binary
  local stage ctrl
  stage=$(mktemp -d)
  ctrl=$(mktemp -d)

  install -Dm755 build/bin/book-studio "$stage/usr/bin/book-studio"
  install -Dm644 build/linux/book-studio.desktop "$stage/usr/share/applications/book-studio.desktop"
  install -Dm644 build/appicon.png "$stage/usr/share/icons/hicolor/512x512/apps/book-studio.png"

  local size
  size=$(du -sk "$stage" | cut -f1)
  cat > "$ctrl/control" <<EOF
Package: book-studio
Version: ${VERSION}
Section: editors
Priority: optional
Architecture: amd64
Installed-Size: ${size}
Depends: libwebkit2gtk-4.1-0 | libwebkit2gtk-4.1-0t64, libgtk-3-0 | libgtk-3-0t64
Maintainer: Giovanni Panasiti <giova.panasiti@gmail.com>
Homepage: https://github.com/giovapanasiti/book_studio
Description: Desktop studio to write, design and export books and magazines
 Write chapters in markdown, keep a story bible, design the page and the
 cover, then export a print-ready PDF and an ePub.
EOF

  local work
  work=$(mktemp -d)
  echo "2.0" > "$work/debian-binary"
  tar -C "$ctrl" --owner=0 --group=0 -czf "$work/control.tar.gz" ./control
  tar -C "$stage" --owner=0 --group=0 -czf "$work/data.tar.gz" ./usr
  local deb="$DIST/book-studio_${VERSION}_amd64.deb"
  rm -f "$deb"
  # A .deb is an ar archive with these three members, in this order.
  ar rc "$deb" "$work/debian-binary" "$work/control.tar.gz" "$work/data.tar.gz"
  rm -rf "$stage" "$ctrl" "$work"
  echo "built: $deb"
}

target_windows() {
  wails build -platform windows/amd64
  local stage
  stage=$(mktemp -d)
  mkdir -p "$stage/book-studio"
  cp build/bin/book-studio.exe "$stage/book-studio/"
  bsdtar -a -cf "$DIST/book-studio_${VERSION}_windows_amd64.zip" -C "$stage" book-studio
  rm -rf "$stage"
  echo "built: $DIST/book-studio_${VERSION}_windows_amd64.zip"
}

case "${1:-all}" in
  linux) target_linux ;;
  deb) target_deb ;;
  windows) target_windows ;;
  all)
    target_linux
    target_deb
    target_windows
    ;;
  *)
    echo "usage: $0 [linux|deb|windows|all]" >&2
    exit 1
    ;;
esac
