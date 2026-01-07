import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { api } from '../api';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// Allowed image types for validation
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// Basic URL validation
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export default function RichTextEditor(props: RichTextEditorProps) {
  let editorElement: HTMLDivElement | undefined;
  const [editor, setEditor] = createSignal<Editor | null>(null);
  const [uploading, setUploading] = createSignal(false);
  const [uploadError, setUploadError] = createSignal<string | null>(null);
  const [showLinkDialog, setShowLinkDialog] = createSignal(false);
  const [linkUrl, setLinkUrl] = createSignal('');
  
  onMount(() => {
    if (!editorElement) return;
    
    const e = new Editor({
      element: editorElement,
      extensions: [
        StarterKit,
        Image.configure({
          inline: true,
          allowBase64: true,
        }),
        Link.configure({
          openOnClick: false,
        }),
        Placeholder.configure({
          placeholder: props.placeholder || 'Write something...',
        }),
      ],
      content: props.value ? (typeof props.value === 'string' ? JSON.parse(props.value) : props.value) : undefined,
      onUpdate: ({ editor: ed }) => {
        // Send TipTap JSON format for backend compatibility
        props.onChange(JSON.stringify(ed.getJSON()));
      },
    });
    
    setEditor(e);
  });
  
  onCleanup(() => {
    editor()?.destroy();
  });
  
  async function handleImageUpload(file: File) {
    setUploadError(null);
    
    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setUploadError('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.');
      return;
    }
    
    setUploading(true);
    try {
      const uploaded = await api.media.upload(file);
      editor()?.chain().focus().setImage({ src: `/api/media/${uploaded.id}` }).run();
    } catch (err) {
      console.error('Image upload failed:', err);
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }
  
  function handleAddLink() {
    const url = linkUrl().trim();
    if (url && isValidUrl(url)) {
      editor()?.chain().focus().setLink({ href: url }).run();
      setLinkUrl('');
      setShowLinkDialog(false);
    }
  }
  
  function handleFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
    input.value = '';
  }
  
  function isActive(name: string, attrs?: Record<string, unknown>): boolean {
    return editor()?.isActive(name, attrs) ?? false;
  }
  
  return (
    <div class="border border-gray-300 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div class="flex items-center gap-1 p-2 border-b border-gray-200 bg-gray-50 flex-wrap">
        <ToolbarButton
          onClick={() => editor()?.chain().focus().toggleBold().run()}
          active={isActive('bold')}
          title="Bold"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
          </svg>
        </ToolbarButton>
        
        <ToolbarButton
          onClick={() => editor()?.chain().focus().toggleItalic().run()}
          active={isActive('italic')}
          title="Italic"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 4h4m-2 0v16m4 0h-4" transform="skewX(-10)" />
          </svg>
        </ToolbarButton>
        
        <ToolbarButton
          onClick={() => editor()?.chain().focus().toggleStrike().run()}
          active={isActive('strike')}
          title="Strikethrough"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M12 5c-2 0-3 1-3 3 0 1.5 1 2.5 2 3M12 19c2 0 3-1 3-3 0-1.5-1-2.5-2-3" />
          </svg>
        </ToolbarButton>
        
        <div class="w-px h-5 bg-gray-300 mx-1" />
        
        <ToolbarButton
          onClick={() => editor()?.chain().focus().toggleHeading({ level: 2 }).run()}
          active={isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          H2
        </ToolbarButton>
        
        <ToolbarButton
          onClick={() => editor()?.chain().focus().toggleHeading({ level: 3 }).run()}
          active={isActive('heading', { level: 3 })}
          title="Heading 3"
        >
          H3
        </ToolbarButton>
        
        <div class="w-px h-5 bg-gray-300 mx-1" />
        
        <ToolbarButton
          onClick={() => editor()?.chain().focus().toggleBulletList().run()}
          active={isActive('bulletList')}
          title="Bullet List"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </ToolbarButton>
        
        <ToolbarButton
          onClick={() => editor()?.chain().focus().toggleOrderedList().run()}
          active={isActive('orderedList')}
          title="Numbered List"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 6h13M7 12h13M7 18h13M3 6h.01M3 12h.01M3 18h.01" />
          </svg>
        </ToolbarButton>
        
        <div class="w-px h-5 bg-gray-300 mx-1" />
        
        <ToolbarButton
          onClick={() => editor()?.chain().focus().toggleBlockquote().run()}
          active={isActive('blockquote')}
          title="Quote"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </ToolbarButton>
        
        <ToolbarButton
          onClick={() => editor()?.chain().focus().toggleCodeBlock().run()}
          active={isActive('codeBlock')}
          title="Code Block"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </ToolbarButton>
        
        <div class="w-px h-5 bg-gray-300 mx-1" />
        
        <label class={`p-1.5 rounded hover:bg-gray-200 cursor-pointer ${uploading() ? 'opacity-50' : ''}`} title="Insert Image">
          <Show when={!uploading()} fallback={<div class="animate-spin h-4 w-4 border-2 border-gray-600 rounded-full border-t-transparent" />}>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </Show>
          <input type="file" class="hidden" accept="image/*" onChange={handleFileChange} disabled={uploading()} />
        </label>
        
        <ToolbarButton
          onClick={() => setShowLinkDialog(true)}
          active={isActive('link')}
          title="Add Link"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </ToolbarButton>
        
        <ToolbarButton
          onClick={() => editor()?.chain().focus().unsetLink().run()}
          disabled={!isActive('link')}
          title="Remove Link"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </ToolbarButton>
      </div>
      
      {/* Link dialog */}
      <Show when={showLinkDialog()}>
        <div class="absolute z-10 mt-1 p-3 bg-white border border-gray-200 rounded-lg shadow-lg">
          <div class="flex items-center gap-2">
            <input
              type="url"
              placeholder="https://example.com"
              value={linkUrl()}
              onInput={(e) => setLinkUrl(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddLink();
                if (e.key === 'Escape') setShowLinkDialog(false);
              }}
              class="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              autofocus
            />
            <button
              type="button"
              onClick={handleAddLink}
              class="px-2 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setShowLinkDialog(false)}
              class="px-2 py-1 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      </Show>
      
      {/* Upload error */}
      <Show when={uploadError()}>
        <div class="px-4 py-2 text-sm text-red-600 bg-red-50 border-t border-red-200">
          {uploadError()}
        </div>
      </Show>
      
      {/* Editor */}
      <div ref={editorElement} class="prose prose-sm max-w-none p-4 min-h-[200px] focus:outline-none" />
    </div>
  );
}

function ToolbarButton(props: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  children: import('solid-js').JSX.Element;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.title}
      class={`p-1.5 rounded transition-colors ${
        props.active
          ? 'bg-primary-100 text-primary-700'
          : 'text-gray-600 hover:bg-gray-200'
      } ${props.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {props.children}
    </button>
  );
}
