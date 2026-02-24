import type { TipTapDocument, TipTapNode, TipTapMark } from '../api/cms';

/**
 * Convert TipTap JSON document to HTML string
 */
export function tiptapToHtml(document: TipTapDocument | null | undefined): string {
  if (!document?.content) return '';
  return document.content.map(renderNode).join('');
}

function renderNode(node: TipTapNode): string {
  const content = node.content?.map(renderNode).join('') ?? '';
  const marks = node.marks ?? [];

  switch (node.type) {
    case 'paragraph':
      return wrapWithMarks(`<p>${content}</p>`, marks);
    case 'heading':
      const level = node.attrs?.level as number | undefined;
      return wrapWithMarks(`<h${level}>${content}</h${level}>`, marks);
    case 'bulletList':
      return `<ul>${content}</ul>`;
    case 'orderedList':
      return `<ol>${content}</ol>`;
    case 'listItem':
      return `<li>${content}</li>`;
    case 'codeBlock':
      return `<pre><code>${escapeHtml(content)}</code></pre>`;
    case 'blockquote':
      return `<blockquote>${content}</blockquote>`;
    case 'hardBreak':
      return '<br>';
    case 'horizontalRule':
      return '<hr>';
    case 'text':
      return wrapWithMarks(escapeHtml(node.text ?? ''), marks);
    case 'image':
      const src = node.attrs?.src as string | undefined;
      const alt = node.attrs?.alt as string | undefined;
      if (!src) return '';
      return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt ?? '')}">`;
    default:
      return content;
  }
}

function wrapWithMarks(html: string, marks: TipTapMark[]): string {
  return marks.reduce((acc, mark) => {
    switch (mark.type) {
      case 'bold':
        return `<strong>${acc}</strong>`;
      case 'italic':
        return `<em>${acc}</em>`;
      case 'underline':
        return `<u>${acc}</u>`;
      case 'strike':
        return `<s>${acc}</s>`;
      case 'code':
        return `<code>${acc}</code>`;
      case 'link':
        const href = mark.attrs?.href as string | undefined;
        const target = mark.attrs?.target as string | undefined;
        if (!href) return acc;
        return `<a href="${escapeHtml(href)}"${target ? ` target="${escapeHtml(target)}"` : ''}>${acc}</a>`;
      default:
        return acc;
    }
  }, html);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
