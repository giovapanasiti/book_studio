# Book Studio build and release commands.
#
#   make build          native Linux build (build/bin/book-studio)
#   make release        Linux tar.gz + .deb + Windows zip into dist/
#   make release-linux  only the Linux tar.gz
#   make release-deb    only the Debian/Ubuntu package
#   make release-win    only the Windows zip
#   make arch           Arch Linux package (makepkg)
#   make publish        tag v<version>, create the GitHub release with the
#                       dist/ artifacts, and let CI attach the macOS build
#   make test           Go test suite

VERSION := $(shell sed -n 's/^pkgver=//p' PKGBUILD)

.PHONY: build test release release-linux release-deb release-win arch publish clean

build:
	wails build -tags webkit2_41

test:
	go test -tags webkit2_41 ./...

release:
	scripts/release.sh all

release-linux:
	scripts/release.sh linux

release-deb:
	scripts/release.sh deb

release-win:
	scripts/release.sh windows

arch:
	makepkg -f

publish: release
	git tag -f v$(VERSION)
	git push origin v$(VERSION)
	gh release create v$(VERSION) dist/book-studio_$(VERSION)_* \
		--title "Book Studio $(VERSION)" \
		--notes-file docs/release-notes.md || \
	gh release upload v$(VERSION) dist/book-studio_$(VERSION)_* --clobber

clean:
	rm -rf dist build/bin
