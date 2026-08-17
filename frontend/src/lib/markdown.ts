import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: false });

// renderMarkdown converts chapter markdown to HTML and points image
// references at the project image server.
export function renderMarkdown(md: string): string {
  const html = marked.parse(md, { async: false }) as string;
  return html.replace(
    /src="(?!https?:\/\/|\/project-images\/|data:)(?:images\/)?([^"]+)"/g,
    'src="/project-images/$1"'
  );
}
