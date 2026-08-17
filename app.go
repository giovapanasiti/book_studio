package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App is the backend application state.
type App struct {
	ctx        context.Context
	mu         sync.Mutex
	projectDir string
	book       *Book
}

// NewApp creates a new App application struct.
func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// ---------- helpers ----------

var unsafeName = regexp.MustCompile(`[^a-zA-Z0-9._ -]+`)

func sanitizeName(s string) string {
	s = unsafeName.ReplaceAllString(s, "")
	s = strings.TrimSpace(s)
	if s == "" {
		s = "untitled"
	}
	return s
}

func configDir() string {
	home, _ := os.UserHomeDir()
	dir := filepath.Join(home, ".config", "book-studio")
	os.MkdirAll(dir, 0o755)
	return dir
}

type RecentProject struct {
	Path     string `json:"path"`
	Title    string `json:"title"`
	OpenedAt int64  `json:"openedAt"`
}

func loadRecents() []RecentProject {
	data, err := os.ReadFile(filepath.Join(configDir(), "recent.json"))
	if err != nil {
		return []RecentProject{}
	}
	var r []RecentProject
	if json.Unmarshal(data, &r) != nil {
		return []RecentProject{}
	}
	return r
}

func saveRecents(r []RecentProject) {
	data, _ := json.MarshalIndent(r, "", "  ")
	os.WriteFile(filepath.Join(configDir(), "recent.json"), data, 0o644)
}

func (a *App) touchRecent() {
	if a.projectDir == "" || a.book == nil {
		return
	}
	recents := loadRecents()
	out := []RecentProject{{Path: a.projectDir, Title: a.book.Title, OpenedAt: time.Now().Unix()}}
	for _, r := range recents {
		if r.Path != a.projectDir && len(out) < 10 {
			out = append(out, r)
		}
	}
	saveRecents(out)
}

func (a *App) saveBookLocked() error {
	if a.projectDir == "" || a.book == nil {
		return fmt.Errorf("no project is open")
	}
	data, err := json.MarshalIndent(a.book, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(a.projectDir, "book.json"), data, 0o644)
}

// ---------- project lifecycle ----------

// GetRecentProjects returns the recent project list, most recent first.
func (a *App) GetRecentProjects() []RecentProject {
	recents := loadRecents()
	out := []RecentProject{}
	for _, r := range recents {
		if _, err := os.Stat(filepath.Join(r.Path, "book.json")); err == nil {
			out = append(out, r)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].OpenedAt > out[j].OpenedAt })
	return out
}

// ChooseProjectFolder opens a directory picker and returns the chosen path.
func (a *App) ChooseProjectFolder(title string) (string, error) {
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{Title: title})
}

// NewProject creates a project folder structure inside parentDir and opens it.
func (a *App) NewProject(parentDir, title, author string) (string, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if parentDir == "" {
		return "", fmt.Errorf("no folder was selected")
	}
	folder := sanitizeName(title)
	dir := filepath.Join(parentDir, folder)
	if _, err := os.Stat(filepath.Join(dir, "book.json")); err == nil {
		return "", fmt.Errorf("a project already exists at %s", dir)
	}
	for _, sub := range []string{"chapters", "images"} {
		if err := os.MkdirAll(filepath.Join(dir, sub), 0o755); err != nil {
			return "", err
		}
	}
	a.projectDir = dir
	a.book = DefaultBook(title, author)
	// Start each new book with one chapter.
	ch := Chapter{ID: uuid.NewString(), Title: "Chapter 1", File: "chapter-1.md"}
	a.book.Chapters = append(a.book.Chapters, ch)
	first := "# Chapter 1\n\nStart to write here. Use **bold**, *italic* and images.\n"
	if err := os.WriteFile(filepath.Join(dir, "chapters", ch.File), []byte(first), 0o644); err != nil {
		return "", err
	}
	if err := a.saveBookLocked(); err != nil {
		return "", err
	}
	a.touchRecent()
	return dir, nil
}

// OpenProjectDialog shows a directory picker and opens the selected project.
func (a *App) OpenProjectDialog() (string, error) {
	dir, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{Title: "Open a Book Studio project folder"})
	if err != nil || dir == "" {
		return "", err
	}
	return a.OpenProject(dir)
}

// OpenProject opens the project at the given path.
func (a *App) OpenProject(dir string) (string, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	data, err := os.ReadFile(filepath.Join(dir, "book.json"))
	if err != nil {
		return "", fmt.Errorf("this folder is not a Book Studio project: %v", err)
	}
	book := DefaultBook("", "")
	if err := json.Unmarshal(data, book); err != nil {
		return "", fmt.Errorf("cannot read book.json: %v", err)
	}
	a.projectDir = dir
	a.book = book
	a.touchRecent()
	return dir, nil
}

// GetBook returns the current book model as JSON.
func (a *App) GetBook() (string, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.book == nil {
		return "", fmt.Errorf("no project is open")
	}
	data, err := json.Marshal(a.book)
	return string(data), err
}

// SaveBook stores the given book model JSON to disk.
func (a *App) SaveBook(bookJSON string) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.projectDir == "" {
		return fmt.Errorf("no project is open")
	}
	var book Book
	if err := json.Unmarshal([]byte(bookJSON), &book); err != nil {
		return err
	}
	a.book = &book
	return a.saveBookLocked()
}

// GetProjectDir returns the open project directory.
func (a *App) GetProjectDir() string {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.projectDir
}

// ---------- chapters ----------

func (a *App) chapterPath(file string) (string, error) {
	if a.projectDir == "" {
		return "", fmt.Errorf("no project is open")
	}
	clean := filepath.Base(file)
	return filepath.Join(a.projectDir, "chapters", clean), nil
}

// ReadChapter returns the markdown content of a chapter file.
func (a *App) ReadChapter(file string) (string, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	p, err := a.chapterPath(file)
	if err != nil {
		return "", err
	}
	data, err := os.ReadFile(p)
	if os.IsNotExist(err) {
		return "", nil
	}
	return string(data), err
}

// WriteChapter stores markdown content into a chapter file.
func (a *App) WriteChapter(file, content string) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	p, err := a.chapterPath(file)
	if err != nil {
		return err
	}
	return os.WriteFile(p, []byte(content), 0o644)
}

// CreateChapter makes a new chapter file and returns the new chapter as JSON.
func (a *App) CreateChapter(title string) (string, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.book == nil {
		return "", fmt.Errorf("no project is open")
	}
	base := strings.ToLower(strings.ReplaceAll(sanitizeName(title), " ", "-"))
	file := base + ".md"
	n := 1
	for {
		p := filepath.Join(a.projectDir, "chapters", file)
		if _, err := os.Stat(p); os.IsNotExist(err) {
			break
		}
		n++
		file = fmt.Sprintf("%s-%d.md", base, n)
	}
	ch := Chapter{ID: uuid.NewString(), Title: title, File: file}
	content := "# " + title + "\n\n"
	if err := os.WriteFile(filepath.Join(a.projectDir, "chapters", file), []byte(content), 0o644); err != nil {
		return "", err
	}
	a.book.Chapters = append(a.book.Chapters, ch)
	if err := a.saveBookLocked(); err != nil {
		return "", err
	}
	data, _ := json.Marshal(ch)
	return string(data), nil
}

// DeleteChapter removes a chapter and its file.
func (a *App) DeleteChapter(id string) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.book == nil {
		return fmt.Errorf("no project is open")
	}
	out := a.book.Chapters[:0]
	for _, ch := range a.book.Chapters {
		if ch.ID == id {
			p, _ := a.chapterPath(ch.File)
			os.Remove(p)
			continue
		}
		out = append(out, ch)
	}
	a.book.Chapters = out
	return a.saveBookLocked()
}

// DuplicateChapter copies a chapter and returns the new chapter as JSON.
func (a *App) DuplicateChapter(id string) (string, error) {
	a.mu.Lock()
	var src *Chapter
	for i := range a.book.Chapters {
		if a.book.Chapters[i].ID == id {
			src = &a.book.Chapters[i]
			break
		}
	}
	if src == nil {
		a.mu.Unlock()
		return "", fmt.Errorf("chapter not found")
	}
	p, _ := a.chapterPath(src.File)
	content, _ := os.ReadFile(p)
	title := src.Title + " copy"
	a.mu.Unlock()

	newJSON, err := a.CreateChapter(title)
	if err != nil {
		return "", err
	}
	var ch Chapter
	json.Unmarshal([]byte(newJSON), &ch)
	if err := a.WriteChapter(ch.File, string(content)); err != nil {
		return "", err
	}
	return newJSON, nil
}

// ---------- story bible ----------

// GetBible returns the story bible JSON for the open project.
// A project without a bible returns an empty object.
func (a *App) GetBible() (string, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.projectDir == "" {
		return "", fmt.Errorf("no project is open")
	}
	data, err := os.ReadFile(filepath.Join(a.projectDir, "bible.json"))
	if os.IsNotExist(err) {
		return "{}", nil
	}
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// SaveBible stores the story bible JSON to disk.
func (a *App) SaveBible(bibleJSON string) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.projectDir == "" {
		return fmt.Errorf("no project is open")
	}
	var check map[string]any
	if err := json.Unmarshal([]byte(bibleJSON), &check); err != nil {
		return fmt.Errorf("bad bible data: %v", err)
	}
	var pretty []byte
	pretty, _ = json.MarshalIndent(check, "", "  ")
	return os.WriteFile(filepath.Join(a.projectDir, "bible.json"), pretty, 0o644)
}

// ---------- images ----------

// ImportImages opens a file picker and copies chosen images into the project.
func (a *App) ImportImages() ([]string, error) {
	if a.GetProjectDir() == "" {
		return nil, fmt.Errorf("no project is open")
	}
	files, err := runtime.OpenMultipleFilesDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Import images",
		Filters: []runtime.FileFilter{
			{DisplayName: "Images", Pattern: "*.png;*.jpg;*.jpeg;*.gif;*.webp;*.svg"},
		},
	})
	if err != nil {
		return nil, err
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	added := []string{}
	for _, src := range files {
		name := sanitizeName(filepath.Base(src))
		dst := filepath.Join(a.projectDir, "images", name)
		// Do not overwrite: add a numeric suffix when the name exists.
		ext := filepath.Ext(name)
		stem := strings.TrimSuffix(name, ext)
		n := 1
		for {
			if _, err := os.Stat(dst); os.IsNotExist(err) {
				break
			}
			n++
			name = fmt.Sprintf("%s-%d%s", stem, n, ext)
			dst = filepath.Join(a.projectDir, "images", name)
		}
		data, err := os.ReadFile(src)
		if err != nil {
			continue
		}
		if err := os.WriteFile(dst, data, 0o644); err != nil {
			continue
		}
		added = append(added, name)
	}
	return added, nil
}

// ListImages returns the image file names in the project.
func (a *App) ListImages() ([]string, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.projectDir == "" {
		return nil, fmt.Errorf("no project is open")
	}
	entries, err := os.ReadDir(filepath.Join(a.projectDir, "images"))
	if err != nil {
		return []string{}, nil
	}
	out := []string{}
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		switch strings.ToLower(filepath.Ext(e.Name())) {
		case ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg":
			out = append(out, e.Name())
		}
	}
	sort.Strings(out)
	return out, nil
}

// DeleteImage removes an image from the project.
func (a *App) DeleteImage(name string) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.projectDir == "" {
		return fmt.Errorf("no project is open")
	}
	return os.Remove(filepath.Join(a.projectDir, "images", filepath.Base(name)))
}

// RenameImage renames an image file and returns the final name.
func (a *App) RenameImage(oldName, newName string) (string, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.projectDir == "" {
		return "", fmt.Errorf("no project is open")
	}
	oldPath := filepath.Join(a.projectDir, "images", filepath.Base(oldName))
	ext := filepath.Ext(oldName)
	clean := sanitizeName(strings.TrimSuffix(filepath.Base(newName), filepath.Ext(newName)))
	final := clean + ext
	newPath := filepath.Join(a.projectDir, "images", final)
	if err := os.Rename(oldPath, newPath); err != nil {
		return "", err
	}
	return final, nil
}

// SaveEditedImage stores a base64 PNG data URL as a new image and returns its name.
func (a *App) SaveEditedImage(name string, dataURL string) (string, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.projectDir == "" {
		return "", fmt.Errorf("no project is open")
	}
	idx := strings.Index(dataURL, ",")
	if idx < 0 {
		return "", fmt.Errorf("bad image data")
	}
	raw, err := base64.StdEncoding.DecodeString(dataURL[idx+1:])
	if err != nil {
		return "", err
	}
	stem := strings.TrimSuffix(filepath.Base(name), filepath.Ext(name))
	final := stem + ".png"
	dst := filepath.Join(a.projectDir, "images", final)
	n := 1
	for {
		if _, err := os.Stat(dst); os.IsNotExist(err) {
			break
		}
		n++
		final = fmt.Sprintf("%s-%d.png", stem, n)
		dst = filepath.Join(a.projectDir, "images", final)
	}
	if err := os.WriteFile(dst, raw, 0o644); err != nil {
		return "", err
	}
	return final, nil
}

// SaveCoverRender stores the rasterized cover (a base64 PNG data URL) as
// cover.png in the project. PDF and ePub exports use it when present.
func (a *App) SaveCoverRender(dataURL string) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.projectDir == "" {
		return fmt.Errorf("no project is open")
	}
	idx := strings.Index(dataURL, ",")
	if idx < 0 {
		return fmt.Errorf("bad image data")
	}
	raw, err := base64.StdEncoding.DecodeString(dataURL[idx+1:])
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(a.projectDir, "cover.png"), raw, 0o644)
}

// ---------- export ----------

// ExportEPUB asks for a target file and writes the ePub there.
func (a *App) ExportEPUB() (string, error) {
	a.mu.Lock()
	if a.book == nil {
		a.mu.Unlock()
		return "", fmt.Errorf("no project is open")
	}
	suggested := sanitizeName(a.book.Title) + ".epub"
	a.mu.Unlock()

	target, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Export ePub",
		DefaultFilename: suggested,
		Filters:         []runtime.FileFilter{{DisplayName: "ePub", Pattern: "*.epub"}},
	})
	if err != nil || target == "" {
		return "", err
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	if err := WriteEPUB(a.projectDir, a.book, target); err != nil {
		return "", err
	}
	return target, nil
}

// ExportPDF asks for a target file and writes the PDF there.
func (a *App) ExportPDF() (string, error) {
	a.mu.Lock()
	if a.book == nil {
		a.mu.Unlock()
		return "", fmt.Errorf("no project is open")
	}
	suggested := sanitizeName(a.book.Title) + ".pdf"
	a.mu.Unlock()

	target, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Export PDF",
		DefaultFilename: suggested,
		Filters:         []runtime.FileFilter{{DisplayName: "PDF", Pattern: "*.pdf"}},
	})
	if err != nil || target == "" {
		return "", err
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	if err := WritePDF(a.projectDir, a.book, target); err != nil {
		return "", err
	}
	return target, nil
}

// RevealInFolder opens the system file manager at the given path.
func (a *App) RevealInFolder(path string) {
	runtime.BrowserOpenURL(a.ctx, "file://"+filepath.Dir(path))
}
