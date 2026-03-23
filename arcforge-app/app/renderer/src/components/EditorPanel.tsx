/**
 * Monaco editor for opened file. Read-only for MVP; path and content from props.
 * When scrollToLine is set (e.g. from route node click), scrolls to that line and clears the target.
 */

import React, { useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useGraphStore } from '../store/graphStore';
import { setCurrentEditor, registerEditorForPath } from '../editorRegistry';

export interface EditorPanelProps {
  relativePath: string;
  content: string;
  /** When set, editor will reveal this line (1-based) and then clear. Used when opening from graph route node. */
  scrollToLine?: number;
  /** Whether this tab is active; used to save/restore scroll position on tab switch. */
  isActive?: boolean;
  language?: string;
  onContentChange?: (value: string) => void;
}

const languageByExt: Record<string, string> = {
  '.php': 'php',
  '.js': 'javascript',
  '.ts': 'typescript',
  '.json': 'json',
  '.md': 'markdown',
  '.css': 'css',
  '.blade.php': 'php',
};

function getLanguage(path: string): string {
  if (path.endsWith('.blade.php')) return 'php';
  const ext = path.slice(path.lastIndexOf('.'));
  return languageByExt[ext] ?? 'plaintext';
}

export const EditorPanel: React.FC<EditorPanelProps> = ({
  relativePath,
  content,
  scrollToLine,
  isActive = true,
  onContentChange,
}) => {
  const language = getLanguage(relativePath);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const highlightDecorationIdsRef = useRef<string[]>([]);
  const clearScrollToLine = useGraphStore((s) => s.clearScrollToLine);
  const setFileScrollPosition = useGraphStore((s) => s.setFileScrollPosition);

  // Save scroll when switching away from tab; restore when switching back
  const prevActiveRef = useRef(isActive);
  useEffect(() => {
    if (prevActiveRef.current === isActive) return;
    const wasActive = prevActiveRef.current;
    prevActiveRef.current = isActive;

    const editor = editorRef.current;
    if (!editor) return;

    if (wasActive && !isActive) {
      setFileScrollPosition(relativePath, editor.getScrollTop(), editor.getScrollLeft());
    } else if (!wasActive && isActive) {
      const saved = useGraphStore.getState().fileScrollPositions[relativePath];
      if (saved) {
        // Tab was hidden (display:none); restore after layout settles
        const restore = () => {
          editor.setScrollTop(saved.scrollTop);
          editor.setScrollLeft(saved.scrollLeft);
        };
        requestAnimationFrame(restore);
        setTimeout(restore, 80);
      }
    }
  }, [isActive, relativePath, setFileScrollPosition]);

  useEffect(() => {
    if (scrollToLine == null || !editorRef.current) return;
    const editor = editorRef.current;
    const line = Math.max(1, Math.floor(scrollToLine));
    const t = setTimeout(() => {
      const model = editor.getModel();
      const maxLine = model ? model.getLineCount() : line;
      const safeLine = Math.min(line, Math.max(1, maxLine));
      editor.setPosition({ lineNumber: safeLine, column: 1 });
      editor.revealLineInCenter(safeLine, 0);
      highlightDecorationIdsRef.current = editor.deltaDecorations(
        highlightDecorationIdsRef.current,
        [
          {
            range: {
              startLineNumber: safeLine,
              startColumn: 1,
              endLineNumber: safeLine,
              endColumn: 1,
            },
            options: {
              isWholeLine: true,
              className: 'arcforge-monaco-line-highlight',
            },
          },
        ]
      );
      window.setTimeout(() => {
        if (!editorRef.current) return;
        highlightDecorationIdsRef.current = editorRef.current.deltaDecorations(
          highlightDecorationIdsRef.current,
          []
        );
      }, 1400);
      clearScrollToLine(relativePath);
    }, 150);
    return () => clearTimeout(t);
  }, [scrollToLine, relativePath, clearScrollToLine]);

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <Editor
        height="100%"
        theme={document.documentElement.dataset.theme === 'light' ? 'vs-light' : 'vs-dark'}
        language={language}
        value={content}
        onMount={(editor) => {
          editorRef.current = editor;
          setCurrentEditor(editor);
          registerEditorForPath(relativePath, editor);

          const savedScroll = useGraphStore.getState().fileScrollPositions[relativePath];
          const hasScrollToLine = scrollToLine != null;

          if (hasScrollToLine) {
            const line = Math.max(1, Math.floor(scrollToLine));
            setTimeout(() => {
              const model = editor.getModel();
              const maxLine = model ? model.getLineCount() : line;
              const safeLine = Math.min(line, Math.max(1, maxLine));
              editor.setPosition({ lineNumber: safeLine, column: 1 });
              editor.revealLineInCenter(safeLine, 0);
              clearScrollToLine(relativePath);
            }, 150);
          } else if (savedScroll) {
            const restore = () => {
              editor.setScrollTop(savedScroll.scrollTop);
              editor.setScrollLeft(savedScroll.scrollLeft);
            };
            requestAnimationFrame(restore);
            const layoutDisposable = editor.onDidLayoutChange(() => {
              restore();
              layoutDisposable.dispose();
            });
            setTimeout(restore, 150);
            setTimeout(restore, 400);
          }

          const scrollDisposable = editor.onDidScrollChange(() => {
            setFileScrollPosition(relativePath, editor.getScrollTop(), editor.getScrollLeft());
          });
          editor.onDidDispose(() => {
            scrollDisposable.dispose();
            setCurrentEditor(null);
            registerEditorForPath(relativePath, null);
          });
        }}
        onChange={(value) => onContentChange?.(value ?? '')}
        options={{
          readOnly: !onContentChange,
          minimap: { enabled: true },
          fontSize: 13,
          wordWrap: 'on',
          scrollBeyondLastLine: false,
        }}
        loading={<div style={{ padding: 20, color: '#cccccc' }}>Loading...</div>}
      />
    </div>
  );
};
