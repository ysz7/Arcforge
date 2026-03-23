/**
 * Command palette — extensible list of commands.
 */

export interface Command {
  id: string;
  label: string;
  shortcut?: string;
  run: () => void;
}

const commands: Command[] = [];
const listeners: Array<() => void> = [];

export function registerCommand(cmd: Command): () => void {
  if (commands.some((c) => c.id === cmd.id)) return () => {};
  commands.push(cmd);
  listeners.forEach((l) => l());
  return () => {
    const i = commands.findIndex((c) => c.id === cmd.id);
    if (i >= 0) {
      commands.splice(i, 1);
      listeners.forEach((l) => l());
    }
  };
}

export function getCommands(): Command[] {
  return [...commands];
}

export function subscribeCommands(callback: () => void): () => void {
  listeners.push(callback);
  return () => {
    const i = listeners.indexOf(callback);
    if (i >= 0) listeners.splice(i, 1);
  };
}
