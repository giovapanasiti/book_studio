package main

import (
	"embed"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend/dist
var assets embed.FS

// projectImageHandler serves images from the open project folder at
// /project-images/<name>, so the frontend can show them.
func projectImageHandler(app *App) assetserver.Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Serve installed font files to the cover editor. Only paths
			// inside the known system font directories are allowed.
			if r.URL.Path == "/sysfont" {
				path := r.URL.Query().Get("path")
				if path == "" || !fontPathAllowed(path) {
					http.NotFound(w, r)
					return
				}
				w.Header().Set("Cache-Control", "max-age=86400")
				http.ServeFile(w, r, path)
				return
			}
			const prefix = "/project-images/"
			if !strings.HasPrefix(r.URL.Path, prefix) {
				next.ServeHTTP(w, r)
				return
			}
			dir := app.GetProjectDir()
			if dir == "" {
				http.NotFound(w, r)
				return
			}
			name := filepath.Base(strings.TrimPrefix(r.URL.Path, prefix))
			path := filepath.Join(dir, "images", name)
			if _, err := os.Stat(path); err != nil {
				http.NotFound(w, r)
				return
			}
			http.ServeFile(w, r, path)
		})
	}
}

func appMenu(app *App) *menu.Menu {
	m := menu.NewMenu()
	emit := func(action string) func(*menu.CallbackData) {
		return func(_ *menu.CallbackData) {
			runtime.EventsEmit(app.ctx, "menu", action)
		}
	}
	file := m.AddSubmenu("File")
	file.AddText("New Project…", keys.CmdOrCtrl("n"), emit("new"))
	file.AddText("Open Project…", keys.CmdOrCtrl("o"), emit("open"))
	file.AddSeparator()
	file.AddText("Save", keys.CmdOrCtrl("s"), emit("save"))
	file.AddSeparator()
	file.AddText("Export PDF…", keys.Combo("e", keys.CmdOrCtrlKey, keys.ShiftKey), emit("export-pdf"))
	file.AddText("Export ePub…", keys.Combo("b", keys.CmdOrCtrlKey, keys.ShiftKey), emit("export-epub"))
	file.AddSeparator()
	file.AddText("Quit", keys.CmdOrCtrl("q"), func(_ *menu.CallbackData) {
		runtime.Quit(app.ctx)
	})

	view := m.AddSubmenu("View")
	view.AddText("Focus Mode", keys.Combo("f", keys.CmdOrCtrlKey, keys.ShiftKey), emit("view-focus"))
	view.AddSeparator()
	view.AddText("Write", keys.CmdOrCtrl("1"), emit("view-write"))
	view.AddText("Bible", keys.CmdOrCtrl("2"), emit("view-bible"))
	view.AddText("Design", keys.CmdOrCtrl("3"), emit("view-design"))
	view.AddText("Cover", keys.CmdOrCtrl("4"), emit("view-cover"))
	view.AddText("Preview", keys.CmdOrCtrl("5"), emit("view-preview"))

	help := m.AddSubmenu("Help")
	help.AddText("About Book Studio", nil, emit("about"))
	return m
}

func main() {
	app := NewApp()

	err := wails.Run(&options.App{
		Title:     "Book Studio",
		Width:     1440,
		Height:    920,
		MinWidth:  1000,
		MinHeight: 640,
		AssetServer: &assetserver.Options{
			Assets:     assets,
			Middleware: projectImageHandler(app),
		},
		BackgroundColour: &options.RGBA{R: 24, G: 23, B: 22, A: 1},
		OnStartup:        app.startup,
		Menu:             appMenu(app),
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
