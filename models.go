package main

import "strings"

// Chapter is one entry of the book: a markdown chapter, or a full-page
// image plate (Kind "image").
type Chapter struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	File  string `json:"file"`
	Kind  string `json:"kind,omitempty"`  // "" | "text" | "image"
	Image string `json:"image,omitempty"` // image name for Kind "image"
	Fit   string `json:"fit,omitempty"`   // cover | contain (image pages)
	// Unnumbered marks front/back matter (prologue, dedication, epilogue…):
	// the chapter keeps its page and TOC entry but takes no chapter number,
	// so the first numbered chapter is truly "Chapter 1".
	Unnumbered bool `json:"unnumbered,omitempty"`
}

// IsImagePage reports whether the chapter is a full-page image plate.
func (c Chapter) IsImagePage() bool { return c.Kind == "image" }

// Styles holds the design settings that control pagination and typography.
type Styles struct {
	PageSize         string  `json:"pageSize"` // A5, A4, Digest, Trade, Letter, Magazine, Square
	MarginTop        float64 `json:"marginTop"`
	MarginBottom     float64 `json:"marginBottom"`
	MarginInner      float64 `json:"marginInner"`
	MarginOuter      float64 `json:"marginOuter"`
	BodyFont         string  `json:"bodyFont"`    // serif | sans | mono
	HeadingFont      string  `json:"headingFont"` // serif | sans | mono
	BodySize         float64 `json:"bodySize"`    // pt
	LineHeight       float64 `json:"lineHeight"`  // multiplier
	ParagraphStyle   string  `json:"paragraphStyle"` // indent | space
	Justify          bool    `json:"justify"`
	Hyphenate        bool    `json:"hyphenate"`
	Columns          int     `json:"columns"` // 1 or 2
	ColumnGap        float64 `json:"columnGap"`
	ShowPageNumbers  bool    `json:"showPageNumbers"`
	ShowHeader       bool    `json:"showHeader"`
	DropCaps         bool    `json:"dropCaps"`
	TextColor        string  `json:"textColor"`
	HeadingColor     string  `json:"headingColor"`
	AccentColor      string  `json:"accentColor"`
	PageColor        string  `json:"pageColor"`
	TocEnabled       bool    `json:"tocEnabled"`
	TitlePageEnabled bool    `json:"titlePageEnabled"`
	ChapterNumbering bool    `json:"chapterNumbering"`
	ChapterLabel     string  `json:"chapterLabel"` // "" = by language ("Capitolo", …)
	TocTitle         string  `json:"tocTitle"`     // "" = by language ("Indice", …)
	// KDP print options: paper/ink type (page-count limits differ) and an
	// opt-out for the automatic margin adaptation on KDP trim sizes.
	Paper     string `json:"paper,omitempty"` // white | cream | color-standard | color-premium
	KdpManual bool   `json:"kdpManual,omitempty"`
}

// CoverText is one text element on the cover.
type CoverText struct {
	Text          string  `json:"text"`
	Font          string  `json:"font"` // serif | sans | mono
	Size          float64 `json:"size"` // pt relative to cover
	Color         string  `json:"color"`
	Y             float64 `json:"y"` // vertical position, percent 0-100
	Bold          bool    `json:"bold"`
	Italic        bool    `json:"italic"`
	Uppercase     bool    `json:"uppercase"`
	LetterSpacing float64 `json:"letterSpacing"`
}

// CoverElement is one freeform element on the cover canvas.
type CoverElement struct {
	ID       string  `json:"id"`
	Type     string  `json:"type"` // text | image | rect
	X        float64 `json:"x"`    // percent of cover width
	Y        float64 `json:"y"`    // percent of cover height
	W        float64 `json:"w"`    // percent of cover width
	H        float64 `json:"h"`    // percent of cover height (0 = auto for text)
	Rotation float64 `json:"rotation"`
	Opacity  float64 `json:"opacity"`

	// text
	Text          string  `json:"text"`
	Font          string  `json:"font"` // serif | sans | mono | system family name
	FontPath      string  `json:"fontPath"`
	Size          float64 `json:"size"` // pt
	Color         string  `json:"color"`
	Bold          bool    `json:"bold"`
	Italic        bool    `json:"italic"`
	Uppercase     bool    `json:"uppercase"`
	LetterSpacing float64 `json:"letterSpacing"`
	Align         string  `json:"align"` // L | C | R
	LineHeight    float64 `json:"lineHeight"`

	// image
	Image string `json:"image"`
	Fit   string `json:"fit"` // cover | contain

	// rect
	Fill   string  `json:"fill"`
	Radius float64 `json:"radius"`
}

// Cover holds the cover design.
type Cover struct {
	BgColor     string    `json:"bgColor"`
	BgColor2    string    `json:"bgColor2"`
	GradientOn  bool      `json:"gradientOn"`
	BgImage     string    `json:"bgImage"` // file name inside images/
	Overlay     float64   `json:"overlay"` // 0-1 dark overlay opacity over image
	Title       CoverText `json:"title"`
	Subtitle    CoverText `json:"subtitle"`
	Author      CoverText `json:"author"`
	BorderFrame bool      `json:"borderFrame"`
	FrameColor  string    `json:"frameColor"`
	// Elements is the freeform cover canvas. When present, it replaces the
	// three fixed text slots above (which are kept for older projects).
	Elements []CoverElement `json:"elements"`
}

// Book is the whole project model, stored as book.json in the project folder.
type Book struct {
	Title       string    `json:"title"`
	Subtitle    string    `json:"subtitle"`
	Author      string    `json:"author"`
	Language    string    `json:"language"`
	Description string    `json:"description"`
	Chapters    []Chapter `json:"chapters"`
	Styles      Styles    `json:"styles"`
	Cover       Cover     `json:"cover"`
}

func langCode(lang string) string {
	if len(lang) >= 2 {
		return strings.ToLower(lang[:2])
	}
	return "en"
}

// LocTOC returns the table-of-contents title for the book language.
func LocTOC(lang string) string {
	switch langCode(lang) {
	case "it":
		return "Indice"
	case "fr":
		return "Table des matières"
	case "es":
		return "Índice"
	case "pt":
		return "Índice"
	case "de":
		return "Inhalt"
	default:
		return "Contents"
	}
}

// LocChapter returns the chapter label for the book language.
func LocChapter(lang string) string {
	switch langCode(lang) {
	case "it":
		return "Capitolo"
	case "fr":
		return "Chapitre"
	case "es":
		return "Capítulo"
	case "pt":
		return "Capítulo"
	case "de":
		return "Kapitel"
	default:
		return "Chapter"
	}
}

// LocCover returns the cover label for the book language.
func LocCover(lang string) string {
	switch langCode(lang) {
	case "it":
		return "Copertina"
	case "fr":
		return "Couverture"
	case "es":
		return "Cubierta"
	case "pt":
		return "Capa"
	case "de":
		return "Umschlag"
	default:
		return "Cover"
	}
}

// ChapterLabelFor returns the configured chapter label, or the language default.
func ChapterLabelFor(b *Book) string {
	if s := strings.TrimSpace(b.Styles.ChapterLabel); s != "" {
		return s
	}
	return LocChapter(b.Language)
}

// TocTitleFor returns the configured contents title, or the language default.
func TocTitleFor(b *Book) string {
	if s := strings.TrimSpace(b.Styles.TocTitle); s != "" {
		return s
	}
	return LocTOC(b.Language)
}

// PageSizeMM returns width and height in millimeters for a page size name.
// The KDP-* names are the trim sizes Amazon KDP accepts for paperbacks.
func PageSizeMM(name string) (float64, float64) {
	switch name {
	case "A4":
		return 210, 297
	case "A5":
		return 148, 210
	case "Digest", "KDP-5.5x8.5":
		return 139.7, 215.9 // 5.5 x 8.5 in
	case "Trade", "KDP-6x9":
		return 152.4, 228.6 // 6 x 9 in
	case "Letter", "KDP-8.5x11":
		return 215.9, 279.4
	case "Magazine":
		return 209.55, 273.05 // 8.25 x 10.75 in
	case "Square":
		return 210, 210
	case "KDP-5x8":
		return 127, 203.2
	case "KDP-5.06x7.81":
		return 128.5, 198.4
	case "KDP-5.25x8":
		return 133.35, 203.2
	case "KDP-6.14x9.21":
		return 156, 234
	case "KDP-6.69x9.61":
		return 169.9, 244.1
	case "KDP-7x10":
		return 177.8, 254
	case "KDP-7.44x9.69":
		return 189, 246.1
	case "KDP-7.5x9.25":
		return 190.5, 234.95
	case "KDP-8x10":
		return 203.2, 254
	case "KDP-8.25x6":
		return 209.55, 152.4
	case "KDP-8.25x8.25":
		return 209.55, 209.55
	case "KDP-8.5x8.5":
		return 215.9, 215.9
	case "KDP-8.27x11.69":
		return 210.1, 296.9
	default:
		return 152.4, 228.6
	}
}

// DefaultBook returns a new book with sensible defaults.
func DefaultBook(title, author string) *Book {
	return &Book{
		Title:    title,
		Author:   author,
		Language: "en",
		Chapters: []Chapter{},
		Styles: Styles{
			PageSize:         "Trade",
			MarginTop:        20,
			MarginBottom:     22,
			MarginInner:      22,
			MarginOuter:      18,
			BodyFont:         "serif",
			HeadingFont:      "serif",
			BodySize:         11,
			LineHeight:       1.5,
			ParagraphStyle:   "indent",
			Justify:          true,
			Columns:          1,
			ColumnGap:        8,
			ShowPageNumbers:  true,
			ShowHeader:       true,
			DropCaps:         false,
			TextColor:        "#1c1b19",
			HeadingColor:     "#1c1b19",
			AccentColor:      "#a2622f",
			PageColor:        "#ffffff",
			TocEnabled:       true,
			TitlePageEnabled: true,
			ChapterNumbering: true,
		},
		Cover: Cover{
			BgColor:    "#233242",
			BgColor2:   "#0e151d",
			GradientOn: true,
			Overlay:    0.25,
			Title: CoverText{
				Text: title, Font: "serif", Size: 34, Color: "#f5f1e6",
				Y: 38, Bold: true, LetterSpacing: 0.5,
			},
			Subtitle: CoverText{
				Text: "", Font: "serif", Size: 15, Color: "#d8d2c2",
				Y: 52, Italic: true,
			},
			Author: CoverText{
				Text: author, Font: "sans", Size: 13, Color: "#f5f1e6",
				Y: 86, Uppercase: true, LetterSpacing: 2,
			},
			BorderFrame: false,
			FrameColor:  "#f5f1e6",
		},
	}
}
