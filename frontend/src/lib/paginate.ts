// DOM-based pagination: flows chapter HTML into fixed-size pages so the
// preview shows real page breaks. Text blocks split at word boundaries.

export interface PaginateSpec {
  colWidthPx: number; // width of one text column
  pageHeightPx: number; // inner height of one page
  columns: number;
  cssVars: Record<string, string>;
}

function countWords(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent || '').split(/\s+/).filter(Boolean).length;
  }
  let n = 0;
  node.childNodes.forEach((c) => (n += countWords(c)));
  return n;
}

// cloneRange copies a node keeping only words in [from, to).
function cloneRange(node: Node, from: number, to: number, pos: { i: number }): Node | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const parts = (node.textContent || '').split(/(\s+)/);
    let out = '';
    for (const part of parts) {
      if (/^\s*$/.test(part)) {
        out += part;
        continue;
      }
      if (pos.i >= from && pos.i < to) out += part;
      pos.i++;
    }
    return out ? document.createTextNode(out) : null;
  }
  const el = node as Element;
  const clone = el.cloneNode(false) as Element;
  let any = false;
  el.childNodes.forEach((c) => {
    const cc = cloneRange(c, from, to, pos);
    if (cc) {
      clone.appendChild(cc);
      any = true;
    }
  });
  return any ? clone : null;
}

function sliceBlock(block: Element, from: number, to: number): Element | null {
  const pos = { i: 0 };
  return cloneRange(block, from, to, pos) as Element | null;
}

const SPLITTABLE = new Set(['P', 'BLOCKQUOTE']);

export async function paginate(html: string, spec: PaginateSpec): Promise<string[]> {
  const meas = document.createElement('div');
  meas.className = 'book-typo';
  meas.style.position = 'fixed';
  meas.style.left = '-100000px';
  meas.style.top = '0';
  meas.style.width = spec.colWidthPx + 'px';
  meas.style.visibility = 'hidden';
  for (const [k, v] of Object.entries(spec.cssVars)) meas.style.setProperty(k, v);
  document.body.appendChild(meas);

  const srcDiv = document.createElement('div');
  srcDiv.innerHTML = html;

  // Wait for images so their heights measure correctly.
  const imgs = Array.from(srcDiv.querySelectorAll('img'));
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((res) => {
          if (img.complete) return res();
          img.onload = () => res();
          img.onerror = () => res();
          setTimeout(res, 1500);
        })
    )
  );

  const budget = spec.pageHeightPx * spec.columns;
  const pages: string[] = [];
  let current: Element[] = [];

  const heightWith = (blocks: Element[]): number => {
    meas.innerHTML = '';
    blocks.forEach((b) => meas.appendChild(b.cloneNode(true)));
    return meas.scrollHeight;
  };

  const flush = () => {
    if (current.length) {
      pages.push(current.map((b) => (b as HTMLElement).outerHTML).join('\n'));
      current = [];
    }
  };

  const blocks = Array.from(srcDiv.children);
  for (let bi = 0; bi < blocks.length; bi++) {
    let block = blocks[bi];
    let placed = false;
    let guard = 0;
    while (!placed && guard++ < 50) {
      const h = heightWith([...current, block]);
      if (h <= budget) {
        // Avoid a heading stranded at the very bottom of a page.
        const isHeading = /^H[1-4]$/.test(block.tagName);
        if (isHeading && budget - h < 60 && current.length > 0) {
          flush();
          continue;
        }
        current.push(block);
        placed = true;
      } else if (SPLITTABLE.has(block.tagName) && countWords(block) > 8) {
        const total = countWords(block);
        // Binary search for the number of words that still fits.
        let lo = 0;
        let hi = total;
        while (lo < hi) {
          const mid = Math.ceil((lo + hi) / 2);
          const head = sliceBlock(block, 0, mid);
          const hh = head ? heightWith([...current, head]) : 0;
          if (hh <= budget) lo = mid;
          else hi = mid - 1;
        }
        if (lo <= 0) {
          if (current.length === 0) {
            current.push(block);
            placed = true;
          } else {
            flush();
          }
        } else {
          const head = sliceBlock(block, 0, lo);
          const tail = sliceBlock(block, lo, total);
          if (head) current.push(head);
          flush();
          if (tail) {
            tail.classList.add('cont');
            block = tail;
          } else {
            placed = true;
          }
        }
      } else if (current.length === 0) {
        current.push(block); // too tall alone: place and let it clip
        placed = true;
      } else {
        flush();
      }
    }
  }
  flush();
  document.body.removeChild(meas);
  return pages.length ? pages : [''];
}
