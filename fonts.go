package main

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"

	"golang.org/x/image/font/sfnt"
)

// SystemFont is one installed font face the cover editor can use.
type SystemFont struct {
	Name string `json:"name"` // full face name, e.g. "DejaVu Serif Bold"
	Path string `json:"path"`
}

var (
	fontsOnce  sync.Once
	fontsCache []SystemFont
)

// fontDirs returns the directories that may hold system fonts.
func fontDirs() []string {
	home, _ := os.UserHomeDir()
	return []string{
		"/usr/share/fonts",
		"/usr/local/share/fonts",
		filepath.Join(home, ".local", "share", "fonts"),
		filepath.Join(home, ".fonts"),
	}
}

// fontPathAllowed reports whether a path points into a known font directory.
// The asset server uses it before it serves a font file.
func fontPathAllowed(path string) bool {
	clean, err := filepath.EvalSymlinks(filepath.Clean(path))
	if err != nil {
		clean = filepath.Clean(path)
	}
	for _, dir := range fontDirs() {
		real, err := filepath.EvalSymlinks(dir)
		if err != nil {
			real = dir
		}
		if strings.HasPrefix(clean, real+string(filepath.Separator)) {
			return true
		}
	}
	return false
}

func faceName(f *sfnt.Font) string {
	full, err := f.Name(nil, sfnt.NameIDFull)
	if err == nil && strings.TrimSpace(full) != "" {
		return strings.TrimSpace(full)
	}
	family, err1 := f.Name(nil, sfnt.NameIDFamily)
	sub, err2 := f.Name(nil, sfnt.NameIDSubfamily)
	if err1 != nil {
		return ""
	}
	name := strings.TrimSpace(family)
	if err2 == nil && sub != "" && !strings.EqualFold(sub, "Regular") {
		name += " " + strings.TrimSpace(sub)
	}
	return name
}

func scanFonts() []SystemFont {
	seen := map[string]bool{}
	out := []SystemFont{}
	for _, dir := range fontDirs() {
		filepath.WalkDir(dir, func(path string, d os.DirEntry, err error) error {
			if err != nil || d.IsDir() {
				return nil
			}
			ext := strings.ToLower(filepath.Ext(path))
			if ext != ".ttf" && ext != ".otf" {
				return nil
			}
			data, err := os.ReadFile(path)
			if err != nil {
				return nil
			}
			f, err := sfnt.Parse(data)
			if err != nil {
				return nil
			}
			name := faceName(f)
			if name == "" || seen[name] {
				return nil
			}
			seen[name] = true
			out = append(out, SystemFont{Name: name, Path: path})
			return nil
		})
	}
	sort.Slice(out, func(i, j int) bool {
		return strings.ToLower(out[i].Name) < strings.ToLower(out[j].Name)
	})
	return out
}

// ListSystemFonts returns the installed font faces, scanned once per run.
func (a *App) ListSystemFonts() []SystemFont {
	fontsOnce.Do(func() {
		fontsCache = scanFonts()
	})
	return fontsCache
}
