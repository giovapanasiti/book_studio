package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/go-pdf/fpdf"
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	east "github.com/yuin/goldmark/extension/ast"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/text"
)

const ptToMm = 0.352778

// ---------- small helpers ----------

func hexRGB(s string) (int, int, int) {
	s = strings.TrimPrefix(strings.TrimSpace(s), "#")
	if len(s) == 3 {
		s = string([]byte{s[0], s[0], s[1], s[1], s[2], s[2]})
	}
	if len(s) != 6 {
		return 0, 0, 0
	}
	r, _ := strconv.ParseInt(s[0:2], 16, 32)
	g, _ := strconv.ParseInt(s[2:4], 16, 32)
	b, _ := strconv.ParseInt(s[4:6], 16, 32)
	return int(r), int(g), int(b)
}

func coreFont(name string) string {
	switch name {
	case "sans":
		return "Helvetica"
	case "mono":
		return "Courier"
	default:
		return "Times"
	}
}

// seg is a run of equally-styled text inside one word.
type seg struct {
	text  string
	bold  bool
	ital  bool
	mono  bool
	color string // empty = inherit
}

// word is a sequence of segments with no spaces inside.
type word []seg

// ---------- inline markdown -> words ----------

type inlineState struct {
	bold, ital, mono bool
	color            string
}

func collectInline(n ast.Node, src []byte, st inlineState, runs *[]seg) {
	switch t := n.(type) {
	case *ast.Text:
		*runs = append(*runs, seg{text: string(t.Segment.Value(src)), bold: st.bold, ital: st.ital, mono: st.mono, color: st.color})
		if t.SoftLineBreak() || t.HardLineBreak() {
			*runs = append(*runs, seg{text: " ", bold: st.bold, ital: st.ital, mono: st.mono, color: st.color})
		}
		return
	case *ast.Emphasis:
		if t.Level >= 2 {
			st.bold = true
		} else {
			st.ital = true
		}
	case *ast.CodeSpan:
		st.mono = true
	case *ast.Link:
		st.color = "link"
	case *east.Strikethrough:
		st.ital = true
	case *ast.Image:
		return // block images are handled separately; skip inline
	case *ast.String:
		*runs = append(*runs, seg{text: string(t.Value), bold: st.bold, ital: st.ital, mono: st.mono, color: st.color})
		return
	}
	for c := n.FirstChild(); c != nil; c = c.NextSibling() {
		collectInline(c, src, st, runs)
	}
}

// wordsFromRuns splits styled runs into words on whitespace.
func wordsFromRuns(runs []seg) []word {
	words := []word{}
	var cur word
	flush := func() {
		if len(cur) > 0 {
			words = append(words, cur)
			cur = nil
		}
	}
	for _, r := range runs {
		parts := strings.Split(r.text, " ")
		for i, p := range parts {
			if i > 0 {
				flush()
			}
			p = strings.ReplaceAll(p, "\n", " ")
			p = strings.TrimRight(strings.TrimLeft(p, "\t"), "\t")
			if p == "" {
				continue
			}
			cur = append(cur, seg{text: p, bold: r.bold, ital: r.ital, mono: r.mono, color: r.color})
		}
	}
	flush()
	return words
}

func inlineWords(n ast.Node, src []byte) []word {
	runs := []seg{}
	for c := n.FirstChild(); c != nil; c = c.NextSibling() {
		collectInline(c, src, inlineState{}, &runs)
	}
	return wordsFromRuns(runs)
}

func plainText(n ast.Node, src []byte) string {
	words := inlineWords(n, src)
	parts := make([]string, 0, len(words))
	for _, w := range words {
		var sb strings.Builder
		for _, s := range w {
			sb.WriteString(s.text)
		}
		parts = append(parts, sb.String())
	}
	return strings.Join(parts, " ")
}

// ---------- layout engine ----------

type engine struct {
	pdf        *fpdf.Fpdf
	tr         func(string) string
	b          *Book
	s          *Styles
	projectDir string

	pageW, pageH float64
	topY, botY   float64
	colW         float64
	curCol       int
	y            float64
	contentX     float64 // left edge of content on current page
	contentW     float64

	inBody         bool
	suppressHeader bool
	headerText     string
	bodyStartPage  int
	folios         map[int]int // chapter index -> folio
	collect        map[int]int
	noFolio        map[int]bool // physical pages without folio/header (image plates)
}

func newEngine(projectDir string, b *Book) *engine {
	w, h := PageSizeMM(b.Styles.PageSize)
	pdf := fpdf.NewCustom(&fpdf.InitType{UnitStr: "mm", Size: fpdf.SizeType{Wd: w, Ht: h}})
	pdf.SetAutoPageBreak(false, 0)
	e := &engine{
		pdf: pdf, b: b, s: &b.Styles, projectDir: projectDir,
		pageW: w, pageH: h,
		collect: map[int]int{},
		noFolio: map[int]bool{},
	}
	e.tr = pdf.UnicodeTranslatorFromDescriptor("")
	e.topY = b.Styles.MarginTop
	e.botY = h - b.Styles.MarginBottom

	pdf.SetHeaderFunc(func() {
		e.applyMargins()
		if e.inBody && e.s.ShowHeader && !e.suppressHeader && !e.noFolio[pdf.PageNo()] {
			pdf.SetFont(coreFont(e.s.HeadingFont), "I", 8)
			r, g, bl := hexRGB(e.s.TextColor)
			pdf.SetTextColor(r, g, bl)
			txt := e.headerText
			if pdf.PageNo()%2 == 0 {
				txt = e.b.Title
			}
			pdf.SetXY(e.contentX, e.topY-9)
			pdf.CellFormat(e.contentW, 5, e.tr(txt), "", 0, "C", false, 0, "")
		}
		e.suppressHeader = false
	})
	pdf.SetFooterFunc(func() {
		if e.inBody && e.s.ShowPageNumbers && !e.noFolio[pdf.PageNo()] {
			folio := pdf.PageNo() - e.bodyStartPage + 1
			if folio >= 1 {
				pdf.SetFont(coreFont(e.s.BodyFont), "", 9)
				r, g, bl := hexRGB(e.s.TextColor)
				pdf.SetTextColor(r, g, bl)
				pdf.SetXY(e.contentX, e.pageH-e.s.MarginBottom+4)
				pdf.CellFormat(e.contentW, 5, strconv.Itoa(folio), "", 0, "C", false, 0, "")
			}
		}
	})
	return e
}

func (e *engine) applyMargins() {
	inner, outer := e.s.MarginInner, e.s.MarginOuter
	var left, right float64
	if e.pdf.PageNo()%2 == 1 { // recto
		left, right = inner, outer
	} else {
		left, right = outer, inner
	}
	e.contentX = left
	e.contentW = e.pageW - left - right
	gap := e.s.ColumnGap
	cols := e.s.Columns
	if cols < 1 {
		cols = 1
	}
	if cols > 2 {
		cols = 2
	}
	e.colW = (e.contentW - float64(cols-1)*gap) / float64(cols)
}

func (e *engine) colX() float64 {
	return e.contentX + float64(e.curCol)*(e.colW+e.s.ColumnGap)
}

func (e *engine) addPage() {
	e.pdf.AddPage()
	e.applyMargins()
	e.curCol = 0
	e.y = e.topY
}

// nextColumn moves to the next column or adds a page.
func (e *engine) nextColumn() {
	cols := e.s.Columns
	if cols < 1 {
		cols = 1
	}
	if e.curCol < cols-1 {
		e.curCol++
		e.y = e.topY
	} else {
		e.addPage()
	}
}

// ensure keeps at least h millimeters available; returns after moving if needed.
func (e *engine) ensure(h float64) {
	if e.y+h > e.botY+0.1 {
		e.nextColumn()
	}
}

func (e *engine) setSegFont(s seg, size float64, baseFamily string, baseBold, baseItal bool) {
	family := baseFamily
	if s.mono {
		family = "Courier"
		size *= 0.92
	}
	style := ""
	if s.bold || baseBold {
		style += "B"
	}
	if s.ital || baseItal {
		style += "I"
	}
	e.pdf.SetFont(family, style, size)
	if s.color == "link" {
		r, g, b := hexRGB(e.s.AccentColor)
		e.pdf.SetTextColor(r, g, b)
	}
}

func (e *engine) segWidth(s seg, size float64, family string, baseBold, baseItal bool) float64 {
	e.setSegFont(s, size, family, baseBold, baseItal)
	return e.pdf.GetStringWidth(e.tr(s.text))
}

type paraOpts struct {
	size        float64
	lineH       float64 // mm
	family      string
	bold, ital  bool
	color       string
	justify     bool
	align       string // L C R (used when not justified)
	firstIndent float64
	indentLeft  float64
	indentRight float64
	spaceAfter  float64
	dropCap     bool
}

type line struct {
	words   []word
	width   float64 // total word widths without spaces
	spaces  int
	indent  float64 // left offset for this line
	maxW    float64 // available width for this line
}

// breakLines does greedy line breaking within per-line available widths.
func (e *engine) breakLines(words []word, o paraOpts, availW float64, dcWidth float64, dcLines int) []line {
	lines := []line{}
	spaceW := func() float64 {
		e.pdf.SetFont(o.family, "", o.size)
		return e.pdf.GetStringWidth(e.tr(" "))
	}()
	cur := line{}
	lineIdx := 0
	lineAvail := func(i int) (float64, float64) {
		ind := 0.0
		if i == 0 {
			ind = o.firstIndent
		}
		w := availW - ind
		if o.dropCap && i < dcLines {
			ind += dcWidth
			w -= dcWidth
		}
		return w, ind
	}
	maxW, ind := lineAvail(0)
	cur.maxW, cur.indent = maxW, ind
	for _, wd := range words {
		ww := 0.0
		for _, s := range wd {
			ww += e.segWidth(s, o.size, o.family, o.bold, o.ital)
		}
		needed := cur.width + ww
		if len(cur.words) > 0 {
			needed += float64(len(cur.words)) * spaceW
		}
		if len(cur.words) > 0 && needed > cur.maxW {
			cur.spaces = len(cur.words) - 1
			lines = append(lines, cur)
			lineIdx++
			maxW, ind = lineAvail(lineIdx)
			cur = line{maxW: maxW, indent: ind}
		}
		cur.words = append(cur.words, wd)
		cur.width += ww
	}
	if len(cur.words) > 0 {
		cur.spaces = len(cur.words) - 1
		lines = append(lines, cur)
	}
	return lines
}

// writePara renders one paragraph-like element into the flow.
func (e *engine) writePara(words []word, o paraOpts) {
	if len(words) == 0 {
		return
	}
	availW := e.colW - o.indentLeft - o.indentRight

	// Drop cap preparation: pull the first letter out of the first word.
	dcLines := 0
	dcChar := ""
	dcWidth := 0.0
	dcSize := 0.0
	if o.dropCap {
		first := words[0]
		if len(first) > 0 && len(first[0].text) > 0 {
			runes := []rune(first[0].text)
			dcChar = string(runes[0])
			rest := string(runes[1:])
			if rest == "" && len(first) == 1 {
				words = words[1:]
			} else {
				nf := word{}
				if rest != "" {
					nf = append(nf, seg{text: rest, bold: first[0].bold, ital: first[0].ital, mono: first[0].mono, color: first[0].color})
				}
				nf = append(nf, first[1:]...)
				words = append([]word{nf}, words[1:]...)
			}
			dcLines = 2
			dcSize = o.size * 2.9
			e.pdf.SetFont(o.family, "B", dcSize)
			dcWidth = e.pdf.GetStringWidth(e.tr(dcChar)) + 1.2
			o.firstIndent = 0
		}
	}

	lines := e.breakLines(words, o, availW, dcWidth, dcLines)
	baseSpaceW := func() float64 {
		e.pdf.SetFont(o.family, "", o.size)
		return e.pdf.GetStringWidth(e.tr(" "))
	}()

	r0, g0, b0 := hexRGB(o.color)
	dropRendered := false
	for li, ln := range lines {
		e.ensure(o.lineH)
		if o.dropCap && dcChar != "" && !dropRendered {
			// Render the drop cap aligned with the first two lines.
			e.pdf.SetFont(o.family, "B", dcSize)
			e.pdf.SetTextColor(r0, g0, b0)
			e.pdf.Text(e.colX()+o.indentLeft, e.y+o.lineH*1.72, e.tr(dcChar))
			dropRendered = true
		}
		spaceW := baseSpaceW
		if o.justify && ln.spaces > 0 && li < len(lines)-1 {
			spaceW = baseSpaceW + (ln.maxW-ln.width-float64(ln.spaces)*baseSpaceW)/float64(ln.spaces)
		}
		x := e.colX() + o.indentLeft + ln.indent
		if !o.justify || li == len(lines)-1 {
			total := ln.width + float64(ln.spaces)*baseSpaceW
			if o.align == "C" {
				x += (ln.maxW - total) / 2
			} else if o.align == "R" {
				x += ln.maxW - total
			}
		}
		baseline := e.y + o.lineH*0.78
		for wi, wd := range ln.words {
			for _, s := range wd {
				e.pdf.SetTextColor(r0, g0, b0)
				e.setSegFont(s, o.size, o.family, o.bold, o.ital)
				txt := e.tr(s.text)
				e.pdf.Text(x, baseline, txt)
				x += e.pdf.GetStringWidth(txt)
			}
			if wi < len(ln.words)-1 {
				x += spaceW
			}
		}
		e.y += o.lineH
	}
	// A short drop-cap paragraph must still clear the tall initial letter.
	if o.dropCap && dcChar != "" && len(lines) < dcLines {
		e.y += float64(dcLines-len(lines)) * o.lineH
	}
	e.y += o.spaceAfter
}

// ---------- block rendering ----------

func (e *engine) bodyOpts() paraOpts {
	s := e.s
	return paraOpts{
		size:   s.BodySize,
		lineH:  s.BodySize * ptToMm * s.LineHeight,
		family: coreFont(s.BodyFont),
		color:  s.TextColor,
		justify: s.Justify,
		align:  "L",
	}
}

type blockCtx struct {
	firstPara  bool
	afterHead  bool
	chapterIdx int
}

func (e *engine) renderImageBlock(dest, caption string) {
	name := filepath.Base(strings.TrimPrefix(dest, "images/"))
	path := filepath.Join(e.projectDir, "images", name)
	ext := strings.ToLower(filepath.Ext(name))
	if ext != ".png" && ext != ".jpg" && ext != ".jpeg" && ext != ".gif" {
		return
	}
	if _, err := os.Stat(path); err != nil {
		return
	}
	info := e.pdf.RegisterImageOptions(path, fpdf.ImageOptions{})
	if info == nil || e.pdf.Err() {
		e.pdf.ClearError()
		return
	}
	iw, ih := info.Extent()
	w := e.colW * 0.92
	if iw < w {
		w = iw
	}
	h := ih * (w / iw)
	maxH := (e.botY - e.topY) * 0.75
	if h > maxH {
		w *= maxH / h
		h = maxH
	}
	capH := 0.0
	if caption != "" {
		capH = e.s.BodySize*0.85*ptToMm*1.4 + 1.5
	}
	e.ensure(h + capH + 3)
	x := e.colX() + (e.colW-w)/2
	e.pdf.ImageOptions(path, x, e.y+1.5, w, h, false, fpdf.ImageOptions{}, 0, "")
	e.y += h + 3
	if caption != "" {
		o := e.bodyOpts()
		o.size = e.s.BodySize * 0.85
		o.lineH = o.size * ptToMm * 1.35
		o.ital = true
		o.justify = false
		o.align = "C"
		o.spaceAfter = 2.5
		e.writePara([]word{{seg{text: caption, ital: true}}}, o)
	} else {
		e.y += 1.5
	}
}

func (e *engine) renderBlock(n ast.Node, src []byte, ctx *blockCtx) {
	s := e.s
	switch t := n.(type) {
	case *ast.Heading:
		o := e.bodyOpts()
		o.family = coreFont(s.HeadingFont)
		o.color = s.HeadingColor
		o.bold = true
		o.justify = false
		switch t.Level {
		case 1, 2:
			o.size = s.BodySize * 1.5
		case 3:
			o.size = s.BodySize * 1.2
		default:
			o.size = s.BodySize * 1.05
		}
		o.lineH = o.size * ptToMm * 1.25
		o.spaceAfter = 2.5
		e.ensure(o.lineH*2 + 8) // keep headings with some following text
		e.y += 4
		e.writePara(inlineWords(t, src), o)
		ctx.afterHead = true
		return
	case *ast.Paragraph:
		// A paragraph that only holds one image becomes an image block.
		if img := soloImage(t); img != nil {
			caption := plainText(img, src)
			if string(img.Title) != "" {
				caption = string(img.Title)
			}
			e.renderImageBlock(string(img.Destination), caption)
			ctx.afterHead = false
			return
		}
		o := e.bodyOpts()
		if s.ParagraphStyle == "indent" {
			if !ctx.firstPara && !ctx.afterHead {
				o.firstIndent = 5.5
			}
		} else {
			o.spaceAfter = e.s.BodySize * ptToMm * 0.6
		}
		if s.DropCaps && ctx.firstPara {
			o.dropCap = true
		}
		e.writePara(inlineWords(t, src), o)
		ctx.firstPara = false
		ctx.afterHead = false
		return
	case *ast.List:
		e.renderList(t, src, 0)
		ctx.afterHead = false
		e.y += 1.5
		return
	case *ast.Blockquote:
		for c := t.FirstChild(); c != nil; c = c.NextSibling() {
			if p, ok := c.(*ast.Paragraph); ok {
				o := e.bodyOpts()
				o.ital = true
				o.indentLeft = 8
				o.indentRight = 8
				o.spaceAfter = 2
				e.writePara(inlineWords(p, src), o)
			}
		}
		e.y += 1
		ctx.afterHead = false
		return
	case *ast.FencedCodeBlock, *ast.CodeBlock:
		e.renderCode(n, src)
		ctx.afterHead = false
		return
	case *ast.ThematicBreak:
		lh := e.s.BodySize * ptToMm * e.s.LineHeight
		e.ensure(lh * 2)
		e.y += lh * 0.5
		o := e.bodyOpts()
		o.justify = false
		o.align = "C"
		o.spaceAfter = lh * 0.5
		e.writePara([]word{{seg{text: "*"}}, {seg{text: "*"}}, {seg{text: "*"}}}, o)
		ctx.firstPara = true
		return
	case *ast.HTMLBlock:
		return
	default:
		for c := n.FirstChild(); c != nil; c = c.NextSibling() {
			e.renderBlock(c, src, ctx)
		}
	}
}

func soloImage(p *ast.Paragraph) *ast.Image {
	if p.ChildCount() != 1 {
		return nil
	}
	if img, ok := p.FirstChild().(*ast.Image); ok {
		return img
	}
	return nil
}

func (e *engine) renderList(l *ast.List, src []byte, depth int) {
	idx := l.Start
	if idx == 0 {
		idx = 1
	}
	for it := l.FirstChild(); it != nil; it = it.NextSibling() {
		marker := "•"
		if l.IsOrdered() {
			marker = strconv.Itoa(idx) + "."
			idx++
		}
		first := true
		for c := it.FirstChild(); c != nil; c = c.NextSibling() {
			switch ct := c.(type) {
			case *ast.List:
				e.renderList(ct, src, depth+1)
			default:
				words := inlineWords(c, src)
				if len(words) == 0 {
					continue
				}
				o := e.bodyOpts()
				o.indentLeft = 6 + float64(depth)*6
				o.justify = false
				o.spaceAfter = 1
				if first {
					// Render the marker, then the text with a hanging indent.
					e.ensure(o.lineH)
					r0, g0, b0 := hexRGB(e.s.AccentColor)
					e.pdf.SetTextColor(r0, g0, b0)
					e.pdf.SetFont(o.family, "", o.size)
					e.pdf.Text(e.colX()+o.indentLeft-5, e.y+o.lineH*0.78, e.tr(marker))
					first = false
				}
				e.writePara(words, o)
			}
		}
	}
}

func (e *engine) renderCode(n ast.Node, src []byte) {
	var lines []string
	var l *text.Segments
	switch t := n.(type) {
	case *ast.FencedCodeBlock:
		l = t.Lines()
	case *ast.CodeBlock:
		l = t.Lines()
	default:
		return
	}
	for i := 0; i < l.Len(); i++ {
		seg := l.At(i)
		lines = append(lines, strings.TrimRight(string(seg.Value(src)), "\n"))
	}
	size := e.s.BodySize * 0.85
	lh := size * ptToMm * 1.4
	pad := 2.0
	e.y += 1.5
	r, g, b := hexRGB(e.s.TextColor)
	for i, ln := range lines {
		e.ensure(lh + pad)
		e.pdf.SetFillColor(243, 241, 235)
		topPad, botPad := 0.0, 0.0
		if i == 0 {
			topPad = pad
		}
		if i == len(lines)-1 {
			botPad = pad
		}
		e.pdf.Rect(e.colX(), e.y, e.colW, lh+topPad+botPad, "F")
		e.pdf.SetFont("Courier", "", size)
		e.pdf.SetTextColor(r, g, b)
		e.pdf.Text(e.colX()+pad, e.y+topPad+lh*0.75, e.tr(ln))
		e.y += lh + topPad + botPad
	}
	e.y += 2.5
}

// ---------- document parts ----------

func (e *engine) renderCover() {
	pdf := e.pdf
	c := &e.b.Cover
	e.addPage()
	// A rasterized cover from the cover editor takes precedence: it is the
	// exact design the user sees, with system fonts and freeform elements.
	renderPath := filepath.Join(e.projectDir, "cover.png")
	if _, err := os.Stat(renderPath); err == nil {
		info := pdf.RegisterImageOptions(renderPath, fpdf.ImageOptions{})
		if info != nil && !pdf.Err() {
			pdf.ImageOptions(renderPath, 0, 0, e.pageW, e.pageH, false, fpdf.ImageOptions{}, 0, "")
			return
		}
		pdf.ClearError()
	}
	if c.GradientOn && c.BgImage == "" {
		r1, g1, b1 := hexRGB(c.BgColor)
		r2, g2, b2 := hexRGB(c.BgColor2)
		pdf.LinearGradient(0, 0, e.pageW, e.pageH, r1, g1, b1, r2, g2, b2, 0, 0, 0, 1)
	} else {
		r1, g1, b1 := hexRGB(c.BgColor)
		pdf.SetFillColor(r1, g1, b1)
		pdf.Rect(0, 0, e.pageW, e.pageH, "F")
	}
	if c.BgImage != "" {
		path := filepath.Join(e.projectDir, "images", filepath.Base(c.BgImage))
		ext := strings.ToLower(filepath.Ext(path))
		if _, err := os.Stat(path); err == nil && (ext == ".png" || ext == ".jpg" || ext == ".jpeg" || ext == ".gif") {
			info := pdf.RegisterImageOptions(path, fpdf.ImageOptions{})
			if info != nil && !pdf.Err() {
				iw, ih := info.Extent()
				scale := e.pageW / iw
				if ih*scale < e.pageH {
					scale = e.pageH / ih
				}
				w, h := iw*scale, ih*scale
				pdf.ImageOptions(path, (e.pageW-w)/2, (e.pageH-h)/2, w, h, false, fpdf.ImageOptions{}, 0, "")
			} else {
				pdf.ClearError()
			}
			if c.Overlay > 0 {
				pdf.SetAlpha(c.Overlay, "Normal")
				pdf.SetFillColor(0, 0, 0)
				pdf.Rect(0, 0, e.pageW, e.pageH, "F")
				pdf.SetAlpha(1, "Normal")
			}
		}
	}
	if c.BorderFrame {
		r, g, b := hexRGB(c.FrameColor)
		pdf.SetDrawColor(r, g, b)
		pdf.SetLineWidth(0.6)
		pdf.Rect(10, 10, e.pageW-20, e.pageH-20, "D")
	}
	drawText := func(ct CoverText) {
		txt := strings.TrimSpace(ct.Text)
		if txt == "" {
			return
		}
		if ct.Uppercase {
			txt = strings.ToUpper(txt)
		}
		style := ""
		if ct.Bold {
			style += "B"
		}
		if ct.Italic {
			style += "I"
		}
		r, g, b := hexRGB(ct.Color)
		pdf.SetTextColor(r, g, b)
		lineH := ct.Size * ptToMm * 1.25
		y := e.pageH*ct.Y/100 + lineH*0.5
		// Wrap long titles on the cover.
		wordsIn := strings.Fields(txt)
		maxW := e.pageW * 0.8
		cur := ""
		lines := []string{}
		pdf.SetFont(coreFont(ct.Font), style, ct.Size)
		spacing := ct.LetterSpacing
		measure := func(s string) float64 {
			return pdf.GetStringWidth(e.tr(s)) + spacing*ptToMm*float64(len([]rune(s))-1)
		}
		for _, wd := range wordsIn {
			try := wd
			if cur != "" {
				try = cur + " " + wd
			}
			if cur != "" && measure(try) > maxW {
				lines = append(lines, cur)
				cur = wd
			} else {
				cur = try
			}
		}
		if cur != "" {
			lines = append(lines, cur)
		}
		for _, ln := range lines {
			w := measure(ln)
			x := (e.pageW - w) / 2
			if spacing > 0 {
				for _, rn := range ln {
					ch := string(rn)
					pdf.Text(x, y, e.tr(ch))
					x += pdf.GetStringWidth(e.tr(ch)) + spacing*ptToMm
				}
			} else {
				pdf.Text(x, y, e.tr(ln))
			}
			y += lineH
		}
	}
	drawText(c.Title)
	drawText(c.Subtitle)
	drawText(c.Author)
}

func (e *engine) renderTitlePage() {
	e.addPage()
	o := e.bodyOpts()
	o.justify = false
	o.align = "C"
	e.y = e.pageH * 0.3

	to := o
	to.family = coreFont(e.s.HeadingFont)
	to.size = e.s.BodySize * 2.4
	to.lineH = to.size * ptToMm * 1.3
	to.bold = true
	to.color = e.s.HeadingColor
	to.spaceAfter = 6
	e.writePara(wordsFromRuns([]seg{{text: e.b.Title}}), to)

	if e.b.Subtitle != "" {
		so := o
		so.ital = true
		so.size = e.s.BodySize * 1.3
		so.lineH = so.size * ptToMm * 1.3
		e.writePara(wordsFromRuns([]seg{{text: e.b.Subtitle, ital: true}}), so)
	}
	e.y = e.pageH * 0.7
	ao := o
	ao.size = e.s.BodySize * 1.1
	ao.lineH = ao.size * ptToMm * 1.3
	e.writePara(wordsFromRuns([]seg{{text: strings.ToUpper(e.b.Author)}}), ao)
}

func (e *engine) renderTOC() {
	e.addPage()
	o := e.bodyOpts()
	o.justify = false
	o.family = coreFont(e.s.HeadingFont)
	o.bold = true
	o.size = e.s.BodySize * 1.7
	o.lineH = o.size * ptToMm * 1.3
	o.color = e.s.HeadingColor
	o.spaceAfter = 8
	e.y += 10
	e.writePara(wordsFromRuns([]seg{{text: TocTitleFor(e.b)}}), o)

	body := e.bodyOpts()
	lh := body.lineH * 1.25
	r, g, b := hexRGB(e.s.TextColor)
	for i, ch := range e.b.Chapters {
		if ch.IsImagePage() {
			continue // image plates stay out of the contents
		}
		e.ensure(lh)
		e.pdf.SetFont(body.family, "", body.size)
		e.pdf.SetTextColor(r, g, b)
		folio := "•"
		if e.folios != nil {
			if f, ok := e.folios[i]; ok {
				folio = strconv.Itoa(f)
			}
		}
		title := e.tr(ch.Title)
		numW := 8.0
		titleW := e.pdf.GetStringWidth(title)
		maxTitleW := e.colW - numW - 6
		for titleW > maxTitleW && len(title) > 4 {
			title = title[:len(title)-1]
			titleW = e.pdf.GetStringWidth(title + "…")
		}
		baseline := e.y + lh*0.75
		e.pdf.Text(e.colX(), baseline, title)
		// Dotted leader between the title and the folio.
		dotStart := e.colX() + titleW + 2
		dotEnd := e.colX() + e.colW - numW
		e.pdf.SetFont(body.family, "", body.size*0.9)
		dw := e.pdf.GetStringWidth(". ")
		for x := dotStart; x < dotEnd; x += dw {
			e.pdf.Text(x, baseline, ".")
		}
		e.pdf.SetFont(body.family, "", body.size)
		fw := e.pdf.GetStringWidth(folio)
		e.pdf.Text(e.colX()+e.colW-fw, baseline, folio)
		e.y += lh
	}
}

// renderImagePage draws a full-bleed image plate with no header or folio.
func (e *engine) renderImagePage(i int, ch Chapter) {
	e.suppressHeader = true
	e.addPage()
	e.noFolio[e.pdf.PageNo()] = true
	e.collect[i] = e.pdf.PageNo() - e.bodyStartPage + 1
	if ch.Image == "" {
		return
	}
	path := filepath.Join(e.projectDir, "images", filepath.Base(ch.Image))
	ext := strings.ToLower(filepath.Ext(path))
	if ext != ".png" && ext != ".jpg" && ext != ".jpeg" && ext != ".gif" {
		return
	}
	if _, err := os.Stat(path); err != nil {
		return
	}
	info := e.pdf.RegisterImageOptions(path, fpdf.ImageOptions{})
	if info == nil || e.pdf.Err() {
		e.pdf.ClearError()
		return
	}
	iw, ih := info.Extent()
	if ch.Fit == "contain" {
		scale := e.pageW / iw
		if ih*scale > e.pageH {
			scale = e.pageH / ih
		}
		w, h := iw*scale, ih*scale
		e.pdf.ImageOptions(path, (e.pageW-w)/2, (e.pageH-h)/2, w, h, false, fpdf.ImageOptions{}, 0, "")
		return
	}
	// Full-bleed: scale to cover the page and clip the overflow.
	scale := e.pageW / iw
	if ih*scale < e.pageH {
		scale = e.pageH / ih
	}
	w, h := iw*scale, ih*scale
	e.pdf.ClipRect(0, 0, e.pageW, e.pageH, false)
	e.pdf.ImageOptions(path, (e.pageW-w)/2, (e.pageH-h)/2, w, h, false, fpdf.ImageOptions{}, 0, "")
	e.pdf.ClipEnd()
}

func (e *engine) renderChapter(i, number int, ch Chapter, src []byte) {
	e.suppressHeader = true
	e.headerText = ch.Title
	e.addPage()
	e.collect[i] = e.pdf.PageNo() - e.bodyStartPage + 1

	// Chapter opening.
	e.y = e.topY + (e.botY-e.topY)*0.12
	if e.s.ChapterNumbering && number > 0 {
		o := e.bodyOpts()
		o.justify = false
		o.align = "C"
		o.size = e.s.BodySize * 0.95
		o.lineH = o.size * ptToMm * 1.4
		o.color = e.s.AccentColor
		o.spaceAfter = 3
		e.writePara(wordsFromRuns([]seg{{text: strings.ToUpper(fmt.Sprintf("%s %d", ChapterLabelFor(e.b), number))}}), o)
	}
	to := e.bodyOpts()
	to.justify = false
	to.align = "C"
	to.family = coreFont(e.s.HeadingFont)
	to.bold = true
	to.size = e.s.BodySize * 2.0
	to.lineH = to.size * ptToMm * 1.25
	to.color = e.s.HeadingColor
	to.spaceAfter = 4
	e.writePara(wordsFromRuns([]seg{{text: ch.Title}}), to)

	// Thin accent rule under the title.
	r, g, b := hexRGB(e.s.AccentColor)
	e.pdf.SetDrawColor(r, g, b)
	e.pdf.SetLineWidth(0.4)
	e.pdf.Line(e.contentX+e.contentW/2-12, e.y+1, e.contentX+e.contentW/2+12, e.y+1)
	e.y += 10

	// Parse and render the markdown body.
	md := goldmark.New(goldmark.WithExtensions(extension.GFM))
	doc := md.Parser().Parse(text.NewReader(src))
	ctx := &blockCtx{firstPara: true, chapterIdx: i}
	first := true
	for n := doc.FirstChild(); n != nil; n = n.NextSibling() {
		// Skip a leading H1 that repeats the chapter title.
		if first {
			first = false
			if h, ok := n.(*ast.Heading); ok && h.Level == 1 {
				continue
			}
		}
		e.renderBlock(n, src, ctx)
	}
}

func (e *engine) render() error {
	e.renderCover()
	if e.s.TitlePageEnabled {
		e.renderTitlePage()
	}
	if e.s.TocEnabled {
		e.renderTOC()
	}
	e.inBody = true
	e.bodyStartPage = e.pdf.PageNo() + 1
	number := 0
	for i, ch := range e.b.Chapters {
		if ch.IsImagePage() {
			e.renderImagePage(i, ch)
			continue
		}
		n := 0
		if !ch.Unnumbered {
			number++
			n = number
		}
		src, _ := os.ReadFile(filepath.Join(e.projectDir, "chapters", filepath.Base(ch.File)))
		e.renderChapter(i, n, ch, src)
	}
	e.inBody = false
	return e.pdf.Error()
}

// CountPages typesets the book without writing it and returns the total
// page count. Used by the KDP margin helper: Amazon's required gutter
// depends on how many pages the finished book has.
func CountPages(projectDir string, b *Book) (int, error) {
	e := newEngine(projectDir, b)
	if err := e.render(); err != nil {
		return 0, err
	}
	return e.pdf.PageNo(), nil
}

// WritePDF typesets the whole book and writes it to the target path.
func WritePDF(projectDir string, b *Book, target string) error {
	// Pass 1: collect chapter folio numbers.
	e1 := newEngine(projectDir, b)
	if err := e1.render(); err != nil {
		return err
	}
	// Pass 2: final output with the collected folios in the TOC.
	e2 := newEngine(projectDir, b)
	e2.folios = e1.collect
	if err := e2.render(); err != nil {
		return err
	}
	e2.pdf.SetTitle(b.Title, true)
	e2.pdf.SetAuthor(b.Author, true)
	e2.pdf.SetCreator("Book Studio", true)
	return e2.pdf.OutputFileAndClose(target)
}
