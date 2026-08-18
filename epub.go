package main

import (
	"archive/zip"
	"bytes"
	"fmt"
	"html"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
	ghtml "github.com/yuin/goldmark/renderer/html"
)

func fontStack(name string) string {
	switch name {
	case "sans":
		return `"Helvetica Neue", Arial, sans-serif`
	case "mono":
		return `"Courier New", monospace`
	default:
		return `Georgia, "Times New Roman", serif`
	}
}

func epubMarkdown() goldmark.Markdown {
	// The typographer must emit unicode characters, not HTML entities:
	// entities like &ldquo; are not defined in XHTML and break ePub readers.
	typographer := extension.NewTypographer(
		extension.WithTypographicSubstitutions(extension.TypographicSubstitutions{
			extension.LeftSingleQuote:  []byte("‘"),
			extension.RightSingleQuote: []byte("’"),
			extension.LeftDoubleQuote:  []byte("“"),
			extension.RightDoubleQuote: []byte("”"),
			extension.EnDash:           []byte("–"),
			extension.EmDash:           []byte("—"),
			extension.Ellipsis:         []byte("…"),
			extension.LeftAngleQuote:   []byte("«"),
			extension.RightAngleQuote:  []byte("»"),
			extension.Apostrophe:       []byte("’"),
		}),
	)
	return goldmark.New(
		goldmark.WithExtensions(extension.GFM, typographer),
		goldmark.WithRendererOptions(ghtml.WithXHTML()),
	)
}

func xhtmlDoc(title, lang, body string) string {
	return fmt.Sprintf(`<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="%s">
<head>
<title>%s</title>
<link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
%s
</body>
</html>`, lang, html.EscapeString(title), body)
}

func epubCSS(b *Book) string {
	s := b.Styles
	var sb strings.Builder
	fmt.Fprintf(&sb, `body {
  font-family: %s;
  font-size: %.1fpt;
  line-height: %.2f;
  color: %s;
  text-align: %s;
}
h1, h2, h3, h4 {
  font-family: %s;
  color: %s;
  line-height: 1.2;
  text-align: left;
}
h1 { font-size: 1.9em; margin: 2em 0 1em 0; }
h2 { font-size: 1.4em; margin: 1.6em 0 0.7em 0; }
h3 { font-size: 1.15em; margin: 1.2em 0 0.5em 0; }
img { max-width: 100%%; }
blockquote { margin: 1em 2em; font-style: italic; }
code, pre { font-family: "Courier New", monospace; font-size: 0.9em; }
pre { white-space: pre-wrap; background: #f2f0ea; padding: 0.8em; }
hr { border: none; text-align: center; margin: 1.5em 0; }
hr:after { content: "* * *"; letter-spacing: 0.6em; }
.chapter-number { font-size: 0.9em; letter-spacing: 0.25em; text-transform: uppercase; color: %s; margin-bottom: 0; }
`,
		fontStack(s.BodyFont), s.BodySize, s.LineHeight, s.TextColor,
		map[bool]string{true: "justify", false: "left"}[s.Justify],
		fontStack(s.HeadingFont), s.HeadingColor, s.AccentColor)
	if s.ParagraphStyle == "indent" {
		sb.WriteString("p { margin: 0; text-indent: 1.4em; }\np:first-of-type, h1 + p, h2 + p, h3 + p, blockquote + p, img + p { text-indent: 0; }\n")
	} else {
		sb.WriteString("p { margin: 0 0 0.8em 0; }\n")
	}
	if s.DropCaps {
		sb.WriteString(`.chapter > p:first-of-type:first-letter {
  font-size: 3.2em; float: left; line-height: 0.85; padding-right: 0.08em; font-weight: bold;
}
`)
	}
	sb.WriteString(fmt.Sprintf(`.titlepage { text-align: center; margin-top: 30%%; }
.titlepage h1 { font-size: 2.2em; margin: 0; }
.titlepage .subtitle { font-style: italic; font-size: 1.2em; margin-top: 1em; }
.titlepage .author { margin-top: 4em; text-transform: uppercase; letter-spacing: 0.2em; }
.covertext { text-align: center; padding-top: 20%%; }
.cover-image { text-align: center; margin: 0; }
.cover-image img { max-width: 100%%; max-height: 100%%; }
.plate { text-align: center; margin: 0; page-break-before: always; page-break-after: always; }
.plate img { max-width: 100%%; max-height: 100%%; }
a { color: %s; }
`, s.AccentColor))
	return sb.String()
}

// WriteEPUB builds an EPUB 3 file for the book at the target path.
func WriteEPUB(projectDir string, b *Book, target string) error {
	f, err := os.Create(target)
	if err != nil {
		return err
	}
	defer f.Close()
	zw := zip.NewWriter(f)
	defer zw.Close()

	// mimetype must be first and stored without compression.
	mt, err := zw.CreateHeader(&zip.FileHeader{Name: "mimetype", Method: zip.Store})
	if err != nil {
		return err
	}
	mt.Write([]byte("application/epub+zip"))

	add := func(name, content string) error {
		w, err := zw.Create(name)
		if err != nil {
			return err
		}
		_, err = w.Write([]byte(content))
		return err
	}

	if err := add("META-INF/container.xml", `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`); err != nil {
		return err
	}

	lang := b.Language
	if lang == "" {
		lang = "en"
	}
	md := epubMarkdown()

	type item struct{ id, href, mediaType, properties string }
	items := []item{
		{"css", "style.css", "text/css", ""},
		{"nav", "nav.xhtml", "application/xhtml+xml", "nav"},
	}
	spine := []string{}

	// Cover page. A rasterized cover from the cover editor takes precedence.
	coverRender := false
	if data, err := os.ReadFile(filepath.Join(projectDir, "cover.png")); err == nil {
		w, err := zw.Create("OEBPS/images/cover-render.png")
		if err != nil {
			return err
		}
		w.Write(data)
		items = append(items, item{"cover-render", "images/cover-render.png", "image/png", "cover-image"})
		coverRender = true
	}
	coverImage := strings.TrimSpace(b.Cover.BgImage)
	if coverImage != "" {
		if _, err := os.Stat(filepath.Join(projectDir, "images", coverImage)); err != nil {
			coverImage = ""
		}
	}
	var coverBody string
	if coverRender {
		coverBody = `<div class="cover-image"><img src="images/cover-render.png" alt="Cover"/></div>`
		coverImage = ""
	} else if coverImage != "" {
		coverBody = fmt.Sprintf(`<div class="cover-image"><img src="images/%s" alt="Cover"/></div>`, html.EscapeString(coverImage))
	} else {
		grad := b.Cover.BgColor
		coverBody = fmt.Sprintf(
			`<div class="covertext" style="background-color:%s; color:%s; min-height:95vh;">
<h1 style="color:%s;">%s</h1>
<p style="color:%s; font-style:italic;">%s</p>
<p style="color:%s; text-transform:uppercase; letter-spacing:0.2em; margin-top:5em;">%s</p>
</div>`,
			grad, html.EscapeString(b.Cover.Title.Color),
			html.EscapeString(b.Cover.Title.Color), html.EscapeString(b.Cover.Title.Text),
			html.EscapeString(b.Cover.Subtitle.Color), html.EscapeString(b.Cover.Subtitle.Text),
			html.EscapeString(b.Cover.Author.Color), html.EscapeString(b.Cover.Author.Text))
	}
	if err := add("OEBPS/cover.xhtml", xhtmlDoc("Cover", lang, coverBody)); err != nil {
		return err
	}
	items = append(items, item{"cover", "cover.xhtml", "application/xhtml+xml", ""})
	spine = append(spine, "cover")

	// Title page.
	if b.Styles.TitlePageEnabled {
		body := fmt.Sprintf(`<div class="titlepage"><h1>%s</h1>`, html.EscapeString(b.Title))
		if b.Subtitle != "" {
			body += fmt.Sprintf(`<p class="subtitle">%s</p>`, html.EscapeString(b.Subtitle))
		}
		body += fmt.Sprintf(`<p class="author">%s</p></div>`, html.EscapeString(b.Author))
		if err := add("OEBPS/titlepage.xhtml", xhtmlDoc(b.Title, lang, body)); err != nil {
			return err
		}
		items = append(items, item{"titlepage", "titlepage.xhtml", "application/xhtml+xml", ""})
		spine = append(spine, "titlepage")
	}

	// Chapters and image plates.
	navEntries := []string{}
	number := 0
	for i, ch := range b.Chapters {
		name := fmt.Sprintf("chap-%03d.xhtml", i+1)
		id := fmt.Sprintf("chap%03d", i+1)
		var body string
		if ch.IsImagePage() {
			if ch.Image == "" {
				continue
			}
			body = fmt.Sprintf(`<div class="plate"><img src="images/%s" alt="%s"/></div>`,
				html.EscapeString(filepath.Base(ch.Image)), html.EscapeString(ch.Title))
		} else {
			number++
			raw, _ := os.ReadFile(filepath.Join(projectDir, "chapters", filepath.Base(ch.File)))
			var buf bytes.Buffer
			if err := md.Convert(raw, &buf); err != nil {
				return err
			}
			if b.Styles.ChapterNumbering {
				body += fmt.Sprintf(`<p class="chapter-number">%s %d</p>`+"\n", ChapterLabelFor(b), number)
			}
			body += `<div class="chapter">` + "\n" + buf.String() + "\n</div>"
			navEntries = append(navEntries, fmt.Sprintf(`<li><a href="%s">%s</a></li>`, name, html.EscapeString(ch.Title)))
		}
		if err := add("OEBPS/"+name, xhtmlDoc(ch.Title, lang, body)); err != nil {
			return err
		}
		items = append(items, item{id, name, "application/xhtml+xml", ""})
		spine = append(spine, id)
	}

	// Images.
	imgDir := filepath.Join(projectDir, "images")
	if entries, err := os.ReadDir(imgDir); err == nil {
		for _, e := range entries {
			if e.IsDir() {
				continue
			}
			ext := strings.ToLower(filepath.Ext(e.Name()))
			var mtype string
			switch ext {
			case ".png":
				mtype = "image/png"
			case ".jpg", ".jpeg":
				mtype = "image/jpeg"
			case ".gif":
				mtype = "image/gif"
			case ".webp":
				mtype = "image/webp"
			case ".svg":
				mtype = "image/svg+xml"
			default:
				continue
			}
			data, err := os.ReadFile(filepath.Join(imgDir, e.Name()))
			if err != nil {
				continue
			}
			w, err := zw.Create("OEBPS/images/" + e.Name())
			if err != nil {
				return err
			}
			w.Write(data)
			props := ""
			if e.Name() == coverImage {
				props = "cover-image"
			}
			items = append(items, item{"img-" + strings.NewReplacer(".", "-", " ", "-").Replace(e.Name()), "images/" + e.Name(), mtype, props})
		}
	}

	// CSS.
	if err := add("OEBPS/style.css", epubCSS(b)); err != nil {
		return err
	}

	// Navigation document.
	nav := fmt.Sprintf(`<nav epub:type="toc" id="toc"><h1>%s</h1><ol>%s</ol></nav>`, html.EscapeString(TocTitleFor(b)), strings.Join(navEntries, "\n"))
	if err := add("OEBPS/nav.xhtml", xhtmlDoc(TocTitleFor(b), lang, nav)); err != nil {
		return err
	}

	// NCX for EPUB 2 readers.
	bookID := uuid.NewString()
	var ncx strings.Builder
	fmt.Fprintf(&ncx, `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
<head><meta name="dtb:uid" content="urn:uuid:%s"/></head>
<docTitle><text>%s</text></docTitle>
<navMap>`, bookID, html.EscapeString(b.Title))
	order := 0
	for i, ch := range b.Chapters {
		if ch.IsImagePage() {
			continue
		}
		order++
		fmt.Fprintf(&ncx, `<navPoint id="np-%d" playOrder="%d"><navLabel><text>%s</text></navLabel><content src="chap-%03d.xhtml"/></navPoint>`,
			order, order, html.EscapeString(ch.Title), i+1)
	}
	ncx.WriteString(`</navMap></ncx>`)
	if err := add("OEBPS/toc.ncx", ncx.String()); err != nil {
		return err
	}
	items = append(items, item{"ncx", "toc.ncx", "application/x-dtbncx+xml", ""})

	// Package document.
	var opf strings.Builder
	fmt.Fprintf(&opf, `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="%s">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="bookid">urn:uuid:%s</dc:identifier>
<dc:title>%s</dc:title>
<dc:creator>%s</dc:creator>
<dc:language>%s</dc:language>
<dc:description>%s</dc:description>
<meta property="dcterms:modified">%s</meta>
`, lang, bookID, html.EscapeString(b.Title), html.EscapeString(b.Author), lang,
		html.EscapeString(b.Description), time.Now().UTC().Format("2006-01-02T15:04:05Z"))
	if coverRender {
		opf.WriteString("<meta name=\"cover\" content=\"cover-render\"/>\n")
	} else if coverImage != "" {
		opf.WriteString(`<meta name="cover" content="img-` + strings.NewReplacer(".", "-", " ", "-").Replace(coverImage) + "\"/>\n")
	}
	opf.WriteString("</metadata>\n<manifest>\n")
	for _, it := range items {
		props := ""
		if it.properties != "" {
			props = fmt.Sprintf(` properties="%s"`, it.properties)
		}
		fmt.Fprintf(&opf, `<item id="%s" href="%s" media-type="%s"%s/>`+"\n", it.id, it.href, it.mediaType, props)
	}
	opf.WriteString(`</manifest>` + "\n" + `<spine toc="ncx">` + "\n")
	for _, id := range spine {
		fmt.Fprintf(&opf, `<itemref idref="%s"/>`+"\n", id)
	}
	opf.WriteString("</spine>\n</package>")
	if err := add("OEBPS/content.opf", opf.String()); err != nil {
		return err
	}
	return nil
}
