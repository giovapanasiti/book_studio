import { useRef, useState } from 'react';
import type { Book, Chapter } from '../types';
import { isImagePage, chapterNumbers } from '../types';
import { imageURLStable } from '../api';
import { useCtxMenu } from './ContextMenu';

interface Props {
  book: Book;
  activeChapterId: string | null;
  images: string[];
  onSelectChapter: (id: string) => void;
  onAddChapter: () => void;
  onAddImagePage: (beforeId?: string) => void;
  onSetUnnumbered: (id: string, unnumbered: boolean) => void;
  onRenameChapter: (id: string, title: string) => void;
  onDeleteChapter: (id: string) => void;
  onDuplicateChapter: (id: string) => void;
  onReorderChapters: (chapters: Chapter[]) => void;
  onImportImages: () => void;
  onInsertImage: (name: string) => void;
  onEditImage: (name: string) => void;
  onRenameImage: (name: string) => void;
  onDeleteImage: (name: string) => void;
  onSetCoverImage: (name: string) => void;
}

export function Sidebar(p: Props) {
  const [tab, setTab] = useState<'chapters' | 'images'>('chapters');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [dragOver, setDragOver] = useState<number | null>(null);
  const dragIdx = useRef<number | null>(null);
  const ctx = useCtxMenu();

  const commitRename = () => {
    if (renaming && renameVal.trim()) p.onRenameChapter(renaming, renameVal.trim());
    setRenaming(null);
  };

  const moveChapter = (from: number, to: number) => {
    if (from === to || to < 0 || to > p.book.chapters.length) return;
    const chapters = [...p.book.chapters];
    const [ch] = chapters.splice(from, 1);
    chapters.splice(to > from ? to - 1 : to, 0, ch);
    p.onReorderChapters(chapters);
  };

  const chapterMenu = (ch: Chapter, idx: number) => [
    { header: ch.title },
    {
      label: 'Rename…',
      onClick: () => {
        setRenaming(ch.id);
        setRenameVal(ch.title);
      },
    },
    { label: 'Duplicate', onClick: () => p.onDuplicateChapter(ch.id) },
    { label: 'Insert image page before', onClick: () => p.onAddImagePage(ch.id) },
    ...(!isImagePage(ch)
      ? [
          {
            label: ch.unnumbered ? 'Count in chapter numbers' : 'Exclude from chapter numbers',
            hint: ch.unnumbered ? '' : 'front/back matter',
            onClick: () => p.onSetUnnumbered(ch.id, !ch.unnumbered),
          },
        ]
      : []),
    { sep: true },
    { label: 'Move up', disabled: idx === 0, onClick: () => moveChapter(idx, idx - 1) },
    {
      label: 'Move down',
      disabled: idx === p.book.chapters.length - 1,
      onClick: () => moveChapter(idx, idx + 2),
    },
    { sep: true },
    {
      label: 'Delete chapter',
      danger: true,
      disabled: p.book.chapters.length <= 1,
      onClick: () => p.onDeleteChapter(ch.id),
    },
  ];

  const imageMenu = (name: string) => [
    { header: name },
    { label: 'Insert into chapter', onClick: () => p.onInsertImage(name) },
    { label: 'Edit image…', onClick: () => p.onEditImage(name) },
    { label: 'Use as cover image', onClick: () => p.onSetCoverImage(name) },
    { sep: true },
    { label: 'Rename…', onClick: () => p.onRenameImage(name) },
    { label: 'Delete image', danger: true, onClick: () => p.onDeleteImage(name) },
  ];

  const numbers = chapterNumbers(p.book.chapters);

  return (
    <aside className="sidebar">
      <div className="sidebar-tabs">
        <button className={'sidebar-tab' + (tab === 'chapters' ? ' active' : '')} onClick={() => setTab('chapters')}>
          Chapters
        </button>
        <button className={'sidebar-tab' + (tab === 'images' ? ' active' : '')} onClick={() => setTab('images')}>
          Images
        </button>
      </div>

      {tab === 'chapters' && (
        <>
          <div className="sidebar-body">
            <div className="toc-list">
              {p.book.chapters.map((ch, i) => (
                <button
                  key={ch.id}
                  draggable={renaming !== ch.id}
                  onDragStart={() => (dragIdx.current = i)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(i);
                  }}
                  onDragLeave={() => setDragOver((d) => (d === i ? null : d))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(null);
                    if (dragIdx.current !== null) moveChapter(dragIdx.current, i > dragIdx.current ? i + 1 : i);
                    dragIdx.current = null;
                  }}
                  className={
                    'toc-item' +
                    (ch.id === p.activeChapterId ? ' active' : '') +
                    (dragOver === i ? ' dragover' : '')
                  }
                  onClick={() => p.onSelectChapter(ch.id)}
                  onDoubleClick={() => {
                    setRenaming(ch.id);
                    setRenameVal(ch.title);
                  }}
                  onContextMenu={(e) => ctx(e, chapterMenu(ch, i))}
                >
                  {renaming === ch.id ? (
                    <input
                      className="text-input"
                      style={{ padding: '2px 6px', fontSize: 13 }}
                      autoFocus
                      value={renameVal}
                      onChange={(e) => setRenameVal(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename();
                        if (e.key === 'Escape') setRenaming(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <>
                      <span className="t">{isImagePage(ch) ? '▣ ' + ch.title : ch.title}</span>
                      <span className="leader" />
                      <span className="n">{isImagePage(ch) ? '▣' : numbers.get(ch.id) ?? '·'}</span>
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, margin: 8 }}>
            <button className="sidebar-add" style={{ margin: 0, flex: 1.4 }} onClick={p.onAddChapter}>
              + New chapter
            </button>
            <button
              className="sidebar-add"
              style={{ margin: 0, flex: 1 }}
              title="A full-page image, printed before the next chapter"
              onClick={() => p.onAddImagePage()}
            >
              + Image page
            </button>
          </div>
        </>
      )}

      {tab === 'images' && (
        <>
          <div className="sidebar-body">
            {p.images.length === 0 ? (
              <div className="empty-hint">
                No images yet.
                <br />
                Import photos and drawings, then drop them into a chapter.
              </div>
            ) : (
              <div className="img-grid">
                {p.images.map((name) => (
                  <button
                    key={name}
                    className="img-cell"
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/x-book-image', name)}
                    onDoubleClick={() => p.onInsertImage(name)}
                    onContextMenu={(e) => ctx(e, imageMenu(name))}
                    title={name + ' — double-click to insert, right-click for tools'}
                  >
                    <img src={imageURLStable(name)} alt={name} loading="lazy" />
                    <span className="name">{name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="sidebar-add" onClick={p.onImportImages}>
            + Import images
          </button>
        </>
      )}
    </aside>
  );
}
