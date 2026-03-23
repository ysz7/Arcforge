/**
 * Current Monaco editor instance — used by Edit menu to run actions (Undo, Find, etc.).
 * EditorPanel registers on mount and clears on unmount.
 * Editors are also keyed by file path for scroll position save on tab switch.
 */

import type { IStandaloneCodeEditor } from 'monaco-editor';

let currentEditor: IStandaloneCodeEditor | null = null;
const editorsByPath = new Map<string, IStandaloneCodeEditor>();

export function setCurrentEditor(editor: IStandaloneCodeEditor | null): void {
  currentEditor = editor;
}

export function getCurrentEditor(): IStandaloneCodeEditor | null {
  return currentEditor;
}

export function registerEditorForPath(path: string, editor: IStandaloneCodeEditor | null): void {
  if (editor) {
    editorsByPath.set(path, editor);
  } else {
    editorsByPath.delete(path);
  }
}

export function getEditorForPath(path: string): IStandaloneCodeEditor | null {
  return editorsByPath.get(path) ?? null;
}

/** Run a Monaco editor action by ID. No-op if no editor. */
export function runEditorAction(actionId: string): boolean {
  if (!currentEditor) return false;
  currentEditor.trigger('menu', actionId, null);
  return true;
}

/** Focus editor and dispatch a key so Monaco handles it like the hotkey (Undo/Redo/Cut/Copy/Paste). */
export function runEditorKey(code: string, ctrl: boolean, shift: boolean): boolean {
  if (!currentEditor) return false;
  const editor = currentEditor;
  const dom = editor.getContainerDomNode();
  // Run after menu closes so focus isn't stolen back
  requestAnimationFrame(() => {
    if (!currentEditor) return;
    editor.focus();
    const key = code.replace('Key', '').toLowerCase();
    const ev = new KeyboardEvent('keydown', {
      key: key.length === 1 ? key : code,
      code,
      ctrlKey: ctrl,
      shiftKey: shift,
      bubbles: true,
      cancelable: true,
    });
    dom.dispatchEvent(ev);
  });
  return true;
}
