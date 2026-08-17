# Maintainer: Giovanni Panasiti <giova.panasiti@gmail.com>
#
# Build and install from the repository root:
#   makepkg -si
#
pkgname=book-studio
pkgver=1.0.0
pkgrel=1
pkgdesc="Desktop studio to write, design and export books and magazines as PDF and ePub"
arch=('x86_64')
url="https://github.com/giovapanasiti/book_studio"
license=('MIT')
depends=('webkit2gtk-4.1' 'gtk3')
makedepends=('go' 'nodejs' 'npm')
options=('!debug')

prepare() {
  # Copy the repository into srcdir so the build does not touch the
  # working tree and does not collide with makepkg's own directories.
  mkdir -p "$srcdir/$pkgname"
  tar -C "$startdir" \
    --exclude='./src' --exclude='./pkg' --exclude='./gobin' \
    --exclude='./*.pkg.tar.*' --exclude='./.git' \
    --exclude='./frontend/node_modules' --exclude='./frontend/dist' \
    --exclude='./build/bin' \
    -cf - . | tar -C "$srcdir/$pkgname" -xf -
}

build() {
  cd "$srcdir/$pkgname"
  export CGO_ENABLED=1
  export GOFLAGS="-buildvcs=false"

  # Use an installed Wails CLI when available; install a private copy if not.
  local wails
  if command -v wails >/dev/null 2>&1; then
    wails=wails
  else
    export GOBIN="$srcdir/gobin"
    go install github.com/wailsapp/wails/v2/cmd/wails@latest
    wails="$GOBIN/wails"
  fi

  "$wails" build -tags webkit2_41
}

package() {
  cd "$srcdir/$pkgname"
  install -Dm755 build/bin/book-studio "$pkgdir/usr/bin/book-studio"
  install -Dm644 build/linux/book-studio.desktop "$pkgdir/usr/share/applications/book-studio.desktop"
  install -Dm644 build/appicon.png "$pkgdir/usr/share/icons/hicolor/512x512/apps/book-studio.png"
}
