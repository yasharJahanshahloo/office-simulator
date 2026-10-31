import type { Tool } from './contract';

export interface ToolStyle {
  name: string;
  /** Short mark drawn on the icon. */
  mark: string;
  color: string;
}

export const TOOL_ORDER: readonly Tool[] = ['claude', 'cursor', 'codex', 'hermes'];

export const TOOL_STYLES: Record<Tool, ToolStyle> = {
  claude: { name: 'Claude', mark: 'C', color: '#D97757' },
  cursor: { name: 'Cursor', mark: 'Cu', color: '#111111' },
  codex: { name: 'Codex', mark: 'Cx', color: '#10A37F' },
  hermes: { name: 'Hermes', mark: 'H', color: '#7C3AED' },
};
