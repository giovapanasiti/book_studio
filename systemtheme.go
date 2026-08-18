package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
)

// SystemTheme is the color palette of the active desktop theme.
type SystemTheme struct {
	Found  bool              `json:"found"`
	Stamp  int64             `json:"stamp"` // colors.toml mtime, for cheap change polling
	Colors map[string]string `json:"colors"`
}

var tomlKV = regexp.MustCompile(`(?m)^\s*([A-Za-z_]+)\s*=\s*"([^"]*)"`)

func systemThemeColorsPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".local", "state", "omarchy", "current", "theme", "colors.toml")
}

// GetSystemTheme reads the Omarchy active theme colors when present, so the
// app chrome can match the desktop. Returns found=false on other systems.
func (a *App) GetSystemTheme() string {
	out := SystemTheme{Colors: map[string]string{}}
	path := systemThemeColorsPath()
	info, err := os.Stat(path)
	if err != nil {
		data, _ := json.Marshal(out)
		return string(data)
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		data, _ := json.Marshal(out)
		return string(data)
	}
	for _, m := range tomlKV.FindAllStringSubmatch(string(raw), -1) {
		out.Colors[m[1]] = m[2]
	}
	out.Found = len(out.Colors) > 0
	out.Stamp = info.ModTime().UnixMilli()
	data, _ := json.Marshal(out)
	return string(data)
}
