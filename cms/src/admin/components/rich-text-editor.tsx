import type { Editor } from '@tiptap/core'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  Bold,
  Code,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  Link2Off,
  List,
  ListOrdered,
  Maximize2,
  Minus,
  Quote,
  Redo,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { MediaPicker } from '~/admin/components/media-picker'
import { Button } from '~/admin/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/admin/components/ui/dialog'
import { Input } from '~/admin/components/ui/input'
import { Label } from '~/admin/components/ui/label'
import { Separator } from '~/admin/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/admin/components/ui/tooltip'
import { cn, getMediaUrl, parseEditorContent } from '~/admin/lib/utils'

interface RichTextEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
  minHeight?: string
}

interface ToolbarButtonProps {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  children: React.ReactNode
  tooltip: string
  shortcut?: string
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  children,
  tooltip,
  shortcut,
}: ToolbarButtonProps) {
  const label = shortcut ? `${tooltip} (${shortcut})` : tooltip
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-8 w-8 ${active ? 'bg-primary/10 text-primary' : ''}`}
          disabled={disabled}
          onMouseDown={(e) => {
            e.preventDefault()
            onClick()
          }}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function LinkDialog({
  open,
  onOpenChange,
  initialUrl,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialUrl: string
  onSubmit: (url: string) => void
}) {
  const [url, setUrl] = useState(initialUrl)

  useEffect(() => {
    if (open) {
      setUrl(initialUrl)
    }
  }, [open, initialUrl])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (url.trim()) {
      onSubmit(url.trim())
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Insert Link</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="link-url">URL</Label>
              <Input
                id="link-url"
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!url.trim()}>
              Apply
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function useWordCount(editor: Editor | null, revision: number) {
  return useMemo(() => {
    if (!editor) return { words: 0, characters: 0 }
    const text = editor.getText()
    const trimmed = text.trim()
    const words = trimmed ? trimmed.split(/\s+/).length : 0
    const characters = trimmed.length
    return { words, characters }
  }, [editor, revision])
}

export function RichTextEditor({
  content,
  onChange,
  placeholder,
  minHeight = 'min-h-[400px]',
}: RichTextEditorProps) {
  const [parseError, setParseError] = useState<string | null>(null)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [revision, setRevision] = useState(0)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      // Underline is included in StarterKit v3 — no need to add separately
      Image.configure({
        inline: false,
        allowBase64: false,
      }),
      Placeholder.configure({ placeholder: placeholder || 'Write something...' }),
    ],
    content: parseEditorContent(content),
    onUpdate: ({ editor }) => {
      onChange(JSON.stringify(editor.getJSON()))
      setRevision((r) => r + 1)
    },
  })

  const openLinkDialog = useCallback(() => {
    if (!editor) return
    const prevUrl = editor.getAttributes('link')['href'] as string | undefined
    setLinkUrl(prevUrl || '')
    setLinkDialogOpen(true)
  }, [editor])

  const applyLink = useCallback(
    (url: string) => {
      if (!editor) return
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    },
    [editor],
  )

  const removeLink = useCallback(() => {
    if (!editor) return
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
  }, [editor])

  // Add keyboard shortcut for link (Ctrl+K)
  useEffect(() => {
    if (!editor) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        openLinkDialog()
      }
    }

    const editorEl = editor.view.dom
    editorEl.addEventListener('keydown', handleKeyDown)
    return () => {
      editorEl.removeEventListener('keydown', handleKeyDown)
    }
  }, [editor, openLinkDialog])

  // Update content if it changes externally (e.g. from server)
  useEffect(() => {
    if (editor && content) {
      const currentContent = JSON.stringify(editor.getJSON())
      if (content !== currentContent) {
        try {
          const parsedContent = parseEditorContent(content)
          editor.commands.setContent(parsedContent)
          setParseError(null)
        } catch {
          setParseError('Failed to parse content. Raw text is displayed below.')
        }
      }
    }
  }, [content, editor])

  const addImage = (media: { id: string; filename: string }) => {
    editor?.chain().focus().setImage({ src: getMediaUrl(media) }).run()
  }

  const { words, characters } = useWordCount(editor, revision)

  if (!editor) return null

  const isLinkActive = editor.isActive('link')
  const canUndo = editor.can().undo()
  const canRedo = editor.can().redo()

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          'rounded-md border bg-background flex flex-col',
          isFullscreen && 'fixed inset-4 z-50'
        )}
      >
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/50 p-1">
          {/* Text Style Group */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
            tooltip="Bold"
            shortcut="Ctrl+B"
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            tooltip="Italic"
            shortcut="Ctrl+I"
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive('strike')}
            tooltip="Strikethrough"
            shortcut="Ctrl+Shift+S"
          >
            <Strikethrough className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive('underline')}
            tooltip="Underline"
            shortcut="Ctrl+U"
          >
            <UnderlineIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            active={editor.isActive('code')}
            tooltip="Inline Code"
            shortcut="Ctrl+E"
          >
            <Code className="h-4 w-4" />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Headings Group */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive('heading', { level: 1 })}
            tooltip="Heading 1"
          >
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive('heading', { level: 2 })}
            tooltip="Heading 2"
          >
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive('heading', { level: 3 })}
            tooltip="Heading 3"
          >
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Lists Group */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive('bulletList')}
            tooltip="Bullet List"
          >
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive('orderedList')}
            tooltip="Ordered List"
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Blocks Group */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive('blockquote')}
            tooltip="Blockquote"
          >
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            active={editor.isActive('codeBlock')}
            tooltip="Code Block"
          >
            <Code2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            tooltip="Horizontal Rule"
          >
            <Minus className="h-4 w-4" />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Insert Group */}
          <ToolbarButton
            onClick={openLinkDialog}
            active={isLinkActive}
            tooltip="Link"
            shortcut="Ctrl+K"
          >
            <LinkIcon className="h-4 w-4" />
          </ToolbarButton>
          {isLinkActive && (
            <ToolbarButton onClick={removeLink} tooltip="Unlink">
              <Link2Off className="h-4 w-4" />
            </ToolbarButton>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <MediaPicker
                onSelect={addImage}
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                }
              />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Image
            </TooltipContent>
          </Tooltip>

          <div className="flex-1" />

          {/* Fullscreen Toggle */}
          <ToolbarButton
            onClick={() => setIsFullscreen(!isFullscreen)}
            tooltip={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            <Maximize2 className="h-4 w-4" />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* History Group */}
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!canUndo}
            tooltip="Undo"
            shortcut="Ctrl+Z"
          >
            <Undo className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!canRedo}
            tooltip="Redo"
            shortcut="Ctrl+Shift+Z"
          >
            <Redo className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* Parse Error */}
        {parseError && (
          <div className="border-b border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {parseError}
          </div>
        )}

        {/* Editor Content */}
        <div className={`relative flex-1 ${minHeight}`}>
          <EditorContent
            editor={editor}
            className="prose prose-sm max-w-none p-4 h-full focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:h-full [&_.ProseMirror]:ring-0 [&_.ProseMirror]:focus:ring-2 [&_.ProseMirror]:focus:ring-ring/20 [&_.ProseMirror]:focus:ring-offset-2 [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground"
          />
        </div>

        {/* Footer / Metrics */}
        <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-1 text-xs text-muted-foreground">
          <span>
            {words} {words === 1 ? 'word' : 'words'}
          </span>
          <span>
            {characters} {characters === 1 ? 'character' : 'characters'}
          </span>
        </div>
      </div>

      {/* Link Dialog */}
      <LinkDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        initialUrl={linkUrl}
        onSubmit={applyLink}
      />
    </TooltipProvider>
  )
}
