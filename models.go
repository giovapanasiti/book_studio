package main

// Chapter is one markdown chapter of the book.
type Chapter struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	File  string `json:"file"`
}

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

// PageSizeMM returns width and height in millimeters for a page size name.
func PageSizeMM(name string) (float64, float64) {
	switch name {
	case "A4":
		return 210, 297
	case "A5":
		return 148, 210
	case "Digest":
		return 139.7, 215.9 // 5.5 x 8.5 in
	case "Trade":
		return 152.4, 228.6 // 6 x 9 in
	case "Letter":
		return 215.9, 279.4
	case "Magazine":
		return 209.55, 273.05 // 8.25 x 10.75 in
	case "Square":
		return 210, 210
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
