import * as App from '../wailsjs/go/main/App';
import type { Bible, Book, Chapter, RecentProject, SystemFont } from './types';
import { defaultBible } from './types';

export const api = {
  getRecentProjects: (): Promise<RecentProject[]> =>
    App.GetRecentProjects().then((r) => (r as RecentProject[]) ?? []),
  chooseProjectFolder: (title: string): Promise<string> => App.ChooseProjectFolder(title),
  newProject: (parentDir: string, title: string, author: string): Promise<string> =>
    App.NewProject(parentDir, title, author),
  openProjectDialog: (): Promise<string> => App.OpenProjectDialog(),
  openProject: (dir: string): Promise<string> => App.OpenProject(dir),
  getBook: async (): Promise<Book> => JSON.parse(await App.GetBook()),
  saveBook: (book: Book): Promise<void> => App.SaveBook(JSON.stringify(book)),
  getBible: async (): Promise<Bible> => {
    const raw = JSON.parse(await App.GetBible());
    return { ...defaultBible(), ...raw };
  },
  saveBible: (bible: Bible): Promise<void> => App.SaveBible(JSON.stringify(bible)),
  readChapter: (file: string): Promise<string> => App.ReadChapter(file),
  writeChapter: (file: string, content: string): Promise<void> => App.WriteChapter(file, content),
  createChapter: async (title: string): Promise<Chapter> => JSON.parse(await App.CreateChapter(title)),
  deleteChapter: (id: string): Promise<void> => App.DeleteChapter(id),
  duplicateChapter: async (id: string): Promise<Chapter> => JSON.parse(await App.DuplicateChapter(id)),
  importImages: (): Promise<string[]> => App.ImportImages().then((r) => r ?? []),
  listImages: (): Promise<string[]> => App.ListImages().then((r) => r ?? []),
  deleteImage: (name: string): Promise<void> => App.DeleteImage(name),
  renameImage: (oldName: string, newName: string): Promise<string> => App.RenameImage(oldName, newName),
  saveEditedImage: (name: string, dataURL: string): Promise<string> => App.SaveEditedImage(name, dataURL),
  exportPDF: (): Promise<string> => App.ExportPDF(),
  exportEPUB: (): Promise<string> => App.ExportEPUB(),
  listSystemFonts: (): Promise<SystemFont[]> => App.ListSystemFonts().then((r) => (r as SystemFont[]) ?? []),
  saveCoverRender: (dataURL: string): Promise<void> => App.SaveCoverRender(dataURL),
};

export function sysFontURL(path: string): string {
  return '/sysfont?path=' + encodeURIComponent(path);
}

export function imageURL(name: string): string {
  return '/project-images/' + encodeURIComponent(name) + '?t=' + Date.now();
}

export function imageURLStable(name: string): string {
  return '/project-images/' + encodeURIComponent(name);
}
