import { useCallback, useEffect, useRef, useState } from 'react';
import { EventsOn } from '../wailsjs/runtime/runtime';
import type { Bible, Book, Chapter, Cover, Styles, ViewName } from './types';
import { defaultBible, isImagePage } from './types';
import { ImagePageView } from './components/ImagePageView';
import { api } from './api';
import { ContextMenuProvider } from './components/ContextMenu';
import { ToastProvider, useToast } from './components/Toast';
import { Welcome } from './components/Welcome';
import { Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor';
import type { EditorHandle } from './components/Editor';
import { DesignView } from './components/DesignView';
import { CoverView } from './components/CoverView';
import { PreviewView } from './components/PreviewView';
import { BibleView } from './components/BibleView';
import { ImageEditor } from './components/ImageEditor';
import { Modal } from './components/Modal';

function Studio() {
  const [book, setBook] = useState<Book | null>(null);
  const [projectDir, setProjectDir] = useState<string | null>(null);
  const [view, setView] = useState<ViewName>('write');
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [chapterText, setChapterText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [renamingImage, setRenamingImage] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [showAbout, setShowAbout] = useState(false);
  const toast = useToast();

  const [bible, setBible] = useState<Bible | null>(null);
  const editorRef = useRef<EditorHandle>(null);
  const bookRef = useRef<Book | null>(null);
  const bibleRef = useRef<Bible | null>(null);
  const bibleDirty = useRef(false);
  const chapterRef = useRef<{ file: string; text: string; dirty: boolean } | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  bookRef.current = book;
  bibleRef.current = bible;

  const activeChapter = book?.chapters.find((c) => c.id === activeChapterId) ?? null;

  // ---------- persistence ----------

  const flushSaves = useCallback(async () => {
    const ch = chapterRef.current;
    if (ch?.dirty) {
      await api.writeChapter(ch.file, ch.text).catch((e) => toast('error', String(e)));
      ch.dirty = false;
    }
    if (bookRef.current) {
      await api.saveBook(bookRef.current).catch((e) => toast('error', String(e)));
    }
    if (bibleDirty.current && bibleRef.current) {
      await api.saveBible(bibleRef.current).catch((e) => toast('error', String(e)));
      bibleDirty.current = false;
    }
    setSaving(false);
  }, [toast]);

  const scheduleSave = useCallback(() => {
    setSaving(true);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void flushSaves(), 700);
  }, [flushSaves]);

  const updateBook = useCallback(
    (patch: Partial<Book>) => {
      setBook((b) => (b ? { ...b, ...patch } : b));
      scheduleSave();
    },
    [scheduleSave]
  );

  const updateStyles = useCallback(
    (patch: Partial<Styles>) => {
      setBook((b) => (b ? { ...b, styles: { ...b.styles, ...patch } } : b));
      scheduleSave();
    },
    [scheduleSave]
  );

  const updateCover = useCallback(
    (patch: Partial<Cover>) => {
      setBook((b) => (b ? { ...b, cover: { ...b.cover, ...patch } } : b));
      scheduleSave();
    },
    [scheduleSave]
  );

  const updateBible = useCallback(
    (patch: Partial<Bible>) => {
      setBible((b) => ({ ...(b ?? defaultBible()), ...patch }));
      bibleDirty.current = true;
      scheduleSave();
    },
    [scheduleSave]
  );

  // ---------- project / chapters ----------

  const selectChapter = useCallback(
    async (id: string, bookOverride?: Book) => {
      const b = bookOverride ?? bookRef.current;
      const ch = b?.chapters.find((c) => c.id === id);
      if (!ch) return;
      const prev = chapterRef.current;
      if (prev?.dirty) await api.writeChapter(prev.file, prev.text).catch(() => {});
      const text = await api.readChapter(ch.file).catch(() => '');
      chapterRef.current = { file: ch.file, text, dirty: false };
      setActiveChapterId(id);
      setChapterText(text);
    },
    []
  );

  const openProject = useCallback(
    async (dir: string) => {
      try {
        const b = await api.getBook();
        setProjectDir(dir);
        setBook(b);
        setBible(await api.getBible().catch(() => defaultBible()));
        bibleDirty.current = false;
        setImages(await api.listImages().catch(() => []));
        chapterRef.current = null;
        if (b.chapters.length > 0) await selectChapter(b.chapters[0].id, b);
        setView('write');
      } catch (e) {
        toast('error', String(e));
      }
    },
    [selectChapter, toast]
  );

  const onEditText = (text: string) => {
    setChapterText(text);
    if (chapterRef.current) {
      chapterRef.current.text = text;
      chapterRef.current.dirty = true;
    }
    scheduleSave();
  };

  const addChapter = async () => {
    const n = (bookRef.current?.chapters.length ?? 0) + 1;
    try {
      const ch = await api.createChapter(`Chapter ${n}`);
      const b = await api.getBook();
      setBook(b);
      await selectChapter(ch.id, b);
      setView('write');
    } catch (e) {
      toast('error', String(e));
    }
  };

  const addImagePage = async (beforeId?: string) => {
    try {
      const ch = await api.createChapter('Image page');
      const b = await api.getBook();
      let chapters = b.chapters.map((c) =>
        c.id === ch.id ? { ...c, kind: 'image' as const, fit: 'cover' as const } : c
      );
      if (beforeId) {
        const page = chapters.find((c) => c.id === ch.id);
        if (page) {
          chapters = chapters.filter((c) => c.id !== ch.id);
          const idx = chapters.findIndex((c) => c.id === beforeId);
          chapters.splice(idx < 0 ? chapters.length : idx, 0, page);
        }
      }
      const nb = { ...b, chapters };
      setBook(nb);
      scheduleSave();
      await selectChapter(ch.id, nb);
      setView('write');
    } catch (e) {
      toast('error', String(e));
    }
  };

  const patchChapter = (id: string, patch: Partial<Chapter>) => {
    setBook((b) =>
      b ? { ...b, chapters: b.chapters.map((c) => (c.id === id ? { ...c, ...patch } : c)) } : b
    );
    scheduleSave();
  };

  const renameChapter = (id: string, title: string) => {
    setBook((b) =>
      b ? { ...b, chapters: b.chapters.map((c) => (c.id === id ? { ...c, title } : c)) } : b
    );
    scheduleSave();
  };

  const deleteChapter = async (id: string) => {
    try {
      await api.deleteChapter(id);
      const b = await api.getBook();
      setBook(b);
      if (activeChapterId === id) {
        chapterRef.current = null;
        if (b.chapters.length > 0) await selectChapter(b.chapters[0].id, b);
        else {
          setActiveChapterId(null);
          setChapterText('');
        }
      }
    } catch (e) {
      toast('error', String(e));
    }
  };

  const duplicateChapter = async (id: string) => {
    try {
      await api.duplicateChapter(id);
      setBook(await api.getBook());
    } catch (e) {
      toast('error', String(e));
    }
  };

  const reorderChapters = (chapters: Chapter[]) => {
    setBook((b) => (b ? { ...b, chapters } : b));
    scheduleSave();
  };

  // ---------- images ----------

  const refreshImages = async () => setImages(await api.listImages().catch(() => []));

  const importImagesReturning = async (): Promise<string[]> => {
    try {
      const added = await api.importImages();
      if (added.length) toast('success', `Imported ${added.length} image${added.length > 1 ? 's' : ''}`);
      await refreshImages();
      return added;
    } catch (e) {
      toast('error', String(e));
      return [];
    }
  };

  const importImages = async () => {
    await importImagesReturning();
  };

  const insertImage = (name: string) => {
    setView('write');
    requestAnimationFrame(() => {
      editorRef.current?.insertAtCursor(`![${name.replace(/\.[^.]+$/, '')}](images/${name})`);
    });
  };

  const deleteImage = async (name: string) => {
    try {
      await api.deleteImage(name);
      await refreshImages();
    } catch (e) {
      toast('error', String(e));
    }
  };

  // ---------- export ----------

  // The cover is rasterized from the editor design and stored in the project
  // before every export, so PDF and ePub carry the exact cover on screen.
  const renderCoverForExport = async () => {
    const b = bookRef.current;
    if (!b) return;
    try {
      const { renderCover } = await import('./lib/coverRender');
      const dataURL = await renderCover(b.cover, b.styles.pageSize, 1800);
      await api.saveCoverRender(dataURL);
    } catch (e) {
      toast('error', 'Cover render failed, the export uses the simple cover', String(e));
    }
  };

  const exportPDF = async () => {
    await flushSaves();
    await renderCoverForExport();
    try {
      const path = await api.exportPDF();
      if (path) toast('success', 'PDF exported', path);
    } catch (e) {
      toast('error', 'PDF export failed', String(e));
    }
  };

  const exportEPUB = async () => {
    await flushSaves();
    await renderCoverForExport();
    try {
      const path = await api.exportEPUB();
      if (path) toast('success', 'ePub exported', path);
    } catch (e) {
      toast('error', 'ePub export failed', String(e));
    }
  };

  // ---------- native menu ----------

  useEffect(() => {
    const off = EventsOn('menu', (action: string) => {
      switch (action) {
        case 'save':
          void flushSaves().then(() => toast('info', 'Project saved'));
          break;
        case 'open':
          void api
            .openProjectDialog()
            .then((dir) => {
              if (dir) void openProject(dir);
            })
            .catch((e) => toast('error', String(e)));
          break;
        case 'new':
          void flushSaves().then(() => {
            setBook(null);
            setProjectDir(null);
          });
          break;
        case 'export-pdf':
          if (bookRef.current) void exportPDF();
          break;
        case 'export-epub':
          if (bookRef.current) void exportEPUB();
          break;
        case 'view-write':
          setView('write');
          break;
        case 'view-bible':
          setView('bible');
          break;
        case 'view-design':
          setView('design');
          break;
        case 'view-cover':
          setView('cover');
          break;
        case 'view-preview':
          setView('preview');
          break;
        case 'about':
          setShowAbout(true);
          break;
      }
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- render ----------

  if (!book || !projectDir) {
    return <Welcome onOpened={(dir) => void openProject(dir)} />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="wordmark">
          Book <em>Studio</em>
        </div>
        <div className="project-title">
          <b>{book.title || 'Untitled'}</b>
          {book.author ? ` — ${book.author}` : ''}
        </div>
        <nav className="view-tabs">
          {(
            [
              ['write', 'Write'],
              ['bible', 'Bible'],
              ['design', 'Design'],
              ['cover', 'Cover'],
              ['preview', 'Preview'],
            ] as [ViewName, string][]
          ).map(([v, label]) => (
            <button key={v} className={'view-tab' + (view === v ? ' active' : '')} onClick={() => setView(v)}>
              {label}
            </button>
          ))}
        </nav>
        <span className={'save-state' + (saving ? ' saving' : '')}>{saving ? 'Saving…' : 'Saved'}</span>
        <button className="btn btn-sm" onClick={() => void exportEPUB()}>
          ePub
        </button>
        <button className="btn btn-sm btn-primary" onClick={() => void exportPDF()}>
          Export PDF
        </button>
      </header>

      <div className="workspace">
        <Sidebar
          book={book}
          activeChapterId={activeChapterId}
          images={images}
          onSelectChapter={(id) => {
            setView('write');
            void selectChapter(id);
          }}
          onAddChapter={() => void addChapter()}
          onAddImagePage={(beforeId) => void addImagePage(beforeId)}
          onRenameChapter={renameChapter}
          onDeleteChapter={(id) => void deleteChapter(id)}
          onDuplicateChapter={(id) => void duplicateChapter(id)}
          onReorderChapters={reorderChapters}
          onImportImages={() => void importImages()}
          onInsertImage={insertImage}
          onEditImage={setEditingImage}
          onRenameImage={(n) => {
            setRenamingImage(n);
            setRenameVal(n.replace(/\.[^.]+$/, ''));
          }}
          onDeleteImage={(n) => void deleteImage(n)}
          onSetCoverImage={(n) => {
            updateCover({ bgImage: n });
            setView('cover');
          }}
        />

        <main className="main-pane">
          {view === 'write' &&
            (activeChapter && isImagePage(activeChapter) ? (
              <ImagePageView
                chapter={activeChapter}
                images={images}
                onPatch={(patch) => patchChapter(activeChapter.id, patch)}
                onImportImages={importImagesReturning}
              />
            ) : activeChapter ? (
              <Editor ref={editorRef} value={chapterText} onChange={onEditText} />
            ) : (
              <div className="empty-hint" style={{ marginTop: 80 }}>
                Create a chapter to start writing.
              </div>
            ))}
          {view === 'bible' && (
            <BibleView
              book={book}
              bible={bible ?? defaultBible()}
              images={images}
              onBible={updateBible}
              onGoToChapter={(id) => {
                setView('write');
                void selectChapter(id);
              }}
            />
          )}
          {view === 'design' && <DesignView book={book} onBook={updateBook} onStyles={updateStyles} />}
          {view === 'cover' && (
            <CoverView book={book} images={images} onCover={updateCover} onImagesChanged={() => void refreshImages()} />
          )}
          {view === 'preview' && <PreviewView book={book} />}
        </main>
      </div>

      {editingImage && (
        <ImageEditor
          name={editingImage}
          onClose={() => setEditingImage(null)}
          onSave={(dataURL) => {
            void api
              .saveEditedImage(editingImage, dataURL)
              .then((newName) => {
                toast('success', `Saved ${newName}`);
                setEditingImage(null);
                return refreshImages();
              })
              .catch((e) => toast('error', String(e)));
          }}
        />
      )}

      {renamingImage && (
        <Modal
          title="Rename image"
          onClose={() => setRenamingImage(null)}
          footer={
            <>
              <button className="btn" onClick={() => setRenamingImage(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={!renameVal.trim()}
                onClick={() => {
                  void api
                    .renameImage(renamingImage, renameVal.trim())
                    .then((finalName) => {
                      if (book.cover.bgImage === renamingImage) updateCover({ bgImage: finalName });
                      setRenamingImage(null);
                      return refreshImages();
                    })
                    .catch((e) => toast('error', String(e)));
                }}
              >
                Rename
              </button>
            </>
          }
        >
          <div className="field-row">
            <label>New name</label>
            <input
              className="text-input grow"
              autoFocus
              value={renameVal}
              onChange={(e) => setRenameVal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && renameVal.trim() && (e.target as HTMLInputElement).blur()}
            />
          </div>
          <p className="empty-hint" style={{ textAlign: 'left' }}>
            References inside chapters keep the old name — update them after renaming.
          </p>
        </Modal>
      )}

      {showAbout && (
        <Modal title="Book Studio" onClose={() => setShowAbout(false)}>
          <p style={{ lineHeight: 1.7, color: 'var(--muted)' }}>
            A small workshop for making books and magazines: write chapters in markdown, set the
            typography, design the cover, and export a print-ready PDF or an ePub.
          </p>
          <p style={{ marginTop: 10, color: 'var(--faint)', fontSize: 12 }}>Project: {projectDir}</p>
        </Modal>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ContextMenuProvider>
        <Studio />
      </ContextMenuProvider>
    </ToastProvider>
  );
}
