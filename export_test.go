package main

import (
	"os"
	"path/filepath"
	"testing"
)

func makeTestProject(t *testing.T) (string, *Book) {
	t.Helper()
	dir := t.TempDir()
	os.MkdirAll(filepath.Join(dir, "chapters"), 0o755)
	os.MkdirAll(filepath.Join(dir, "images"), 0o755)
	md1 := `# The Beginning

This is the *first* paragraph with **bold text** and a [link](https://example.com). It continues for a while so that we can see line breaking and justification working across multiple lines of the page.

A second paragraph follows here, with an inline ` + "`code span`" + ` and more prose to fill the line. Typography must look correct.

## A Section

- First item in a list
- Second item with **bold**
- Third item

1. Ordered one
2. Ordered two

> A wise quotation sits here, indented and italic, the way quotations are set in classic books.

` + "```" + `
func main() {
    fmt.Println("hello")
}
` + "```" + `

---

Final paragraph after a scene break.
`
	os.WriteFile(filepath.Join(dir, "chapters", "one.md"), []byte(md1), 0o644)
	os.WriteFile(filepath.Join(dir, "chapters", "two.md"), []byte("# Second\n\nShort chapter body with enough words to make at least a couple of lines when typeset on the page.\n"), 0o644)
	b := DefaultBook("Test Book", "Test Author")
	b.Subtitle = "A Subtitle"
	b.Styles.DropCaps = true
	b.Chapters = []Chapter{
		{ID: "1", Title: "The Beginning", File: "one.md"},
		{ID: "2", Title: "Second", File: "two.md"},
	}
	return dir, b
}

func TestWritePDF(t *testing.T) {
	dir, b := makeTestProject(t)
	target := filepath.Join(dir, "out.pdf")
	if err := WritePDF(dir, b, target); err != nil {
		t.Fatalf("WritePDF: %v", err)
	}
	info, err := os.Stat(target)
	if err != nil || info.Size() < 1000 {
		t.Fatalf("pdf too small or missing: %v", err)
	}
}

func TestWritePDFTwoColumnsMagazine(t *testing.T) {
	dir, b := makeTestProject(t)
	b.Styles.PageSize = "Magazine"
	b.Styles.Columns = 2
	b.Styles.BodyFont = "sans"
	target := filepath.Join(dir, "out2.pdf")
	if err := WritePDF(dir, b, target); err != nil {
		t.Fatalf("WritePDF 2col: %v", err)
	}
}

func TestWriteEPUB(t *testing.T) {
	dir, b := makeTestProject(t)
	target := filepath.Join(dir, "out.epub")
	if err := WriteEPUB(dir, b, target); err != nil {
		t.Fatalf("WriteEPUB: %v", err)
	}
	info, err := os.Stat(target)
	if err != nil || info.Size() < 500 {
		t.Fatalf("epub too small or missing: %v", err)
	}
}
