/**
 * Modal to export architecture graph as AI-friendly prompt text.
 * Shows a header, converted nodes/edges, and toggleable badge buttons that append/remove instruction snippets.
 */

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import type { Graph } from '../../../shared/types/graph';

const ARCH_TYPE_LABELS: Record<string, string> = {
  arch_entry: 'Entry',
  arch_entry_interface: 'Presentation',
  arch_domain: 'Domain',
  arch_aggregate: 'Aggregate',
  arch_entity: 'Entity',
  arch_value_object: 'Value Object',
  arch_service: 'Service',
  arch_use_case: 'Use Case',
  arch_interface: 'Interface',
  arch_repository: 'Repository',
  arch_repository_interface: 'Repository Interface',
  arch_controller: 'Controller',
  arch_model: 'Model',
  arch_middleware: 'Middleware',
  arch_router: 'Router',
  arch_form_request: 'Form Request',
  arch_resource: 'Resource',
  arch_response: 'Response',
  arch_database: 'Database',
  arch_eloquent: 'Eloquent',
  arch_orm: 'ORM',
  arch_migration: 'Migrations',
  arch_seeder: 'Seeders',
  arch_factory: 'Factory',
  arch_di_container: 'DI Container',
  arch_event: 'Event',
  arch_handler: 'Handler',
  arch_listener: 'Listener',
  arch_job: 'Job',
  arch_module: 'Module',
  arch_layer: 'Layer',
  arch_view: 'View',
  arch_microservice: 'Microservice',
  arch_component: 'Component',
  arch_bounded_context: 'Bounded Context',
  arch_application_service: 'Application Service',
  arch_domain_event: 'Domain Event',
};

function graphToAiPrompt(graph: Graph, entryLabel: string): string {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const typeLabel = (type: string) => ARCH_TYPE_LABELS[type] ?? type.replace(/^arch_/, '');

  const lines: string[] = [
    '# Backend Architecture',
    '',
    `Entry point: **${entryLabel}**`,
    '',
    '## Nodes',
  ];
  for (const n of graph.nodes) {
    const kind = typeLabel(n.type);
    lines.push(`- **${n.label}** (${kind})`);
  }
  lines.push('');
  lines.push('## Connections (flow)');
  for (const e of graph.edges) {
    const fromNode = nodeById.get(e.from);
    const toNode = nodeById.get(e.to);
    const fromLabel = fromNode?.label ?? e.from;
    const toLabel = toNode?.label ?? e.to;
    lines.push(`- ${fromLabel} → ${toLabel}`);
  }
  return lines.join('\n');
}

const PROMPT_BADGES: { id: string; label: string; text: string }[] = [
  {
    id: 'generate',
    label: 'Generate code',
    text: 'Generate production-ready code that implements this architecture. Use the same layer and component names.',
  },
  {
    id: 'explain',
    label: 'Explain layers',
    text: 'Explain the role of each layer and how data and control flow between them.',
  },
  {
    id: 'suggest',
    label: 'Suggest improvements',
    text: 'Suggest improvements to this architecture (performance, maintainability, testability).',
  },
  {
    id: 'tests',
    label: 'Add tests',
    text: 'Suggest a testing strategy and example unit/integration tests for this architecture.',
  },
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface ExportArchitectureModalProps {
  graph: Graph;
  entryLabel: string;
  onClose: () => void;
  /** If provided, overrides the auto-generated prompt (e.g. from plugin.onExport). */
  overrideContent?: string;
}

export const ExportArchitectureModal: React.FC<ExportArchitectureModalProps> = ({
  graph,
  entryLabel,
  onClose,
  overrideContent,
}) => {
  const baseContent = useMemo(
    () => overrideContent ?? graphToAiPrompt(graph, entryLabel),
    [graph, entryLabel, overrideContent]
  );

  const [activeBadgeIds, setActiveBadgeIds] = useState<Set<string>>(new Set());
  const [content, setContent] = useState(baseContent);

  const blockForBadge = useCallback((badge: (typeof PROMPT_BADGES)[0]) => {
    return `\n\n---\n\n[Instruction: ${badge.label}]\n\n${badge.text}`;
  }, []);

  const toggleBadge = useCallback(
    (id: string) => {
      const badge = PROMPT_BADGES.find((b) => b.id === id);
      if (!badge) return;
      setActiveBadgeIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
          const block = blockForBadge(badge);
          setContent((c) => c.replace(new RegExp(escapeRegex(block), 'g'), ''));
          return next;
        }
        next.add(id);
        setContent((c) => c + blockForBadge(badge));
        return next;
      });
    },
    [blockForBadge]
  );

  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => setCopied(true));
  }, [content]);

  return (
    <div className="arcforge-modal-overlay" onClick={onClose}>
      <div
        className="arcforge-modal arcforge-export-arch-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="arcforge-modal-header">
          <span className="arcforge-modal-title">Export Architecture</span>
          <button
            type="button"
            className="arcforge-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="arcforge-export-arch-body">
          <p className="arcforge-export-arch-hint">
            Use the content below as a prompt for AI. Toggle badges to add or remove instructions.
          </p>
          <div className="arcforge-export-arch-badges">
            {PROMPT_BADGES.map((b) => (
              <button
                key={b.id}
                type="button"
                className={`arcforge-export-arch-badge ${activeBadgeIds.has(b.id) ? 'active' : ''}`}
                onClick={() => toggleBadge(b.id)}
              >
                {b.label}
              </button>
            ))}
          </div>
          <textarea
            className="arcforge-export-arch-textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
            rows={18}
          />
          <div className="arcforge-modal-divider" style={{ margin: '4px 0 0' }} />
          <div className="arcforge-export-arch-actions">
            <button type="button" className="forge-btn forge-btn-secondary" onClick={handleCopy}>
              {copied ? '✓ Copied' : 'Copy to clipboard'}
            </button>
            <button type="button" className="forge-btn forge-btn-primary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
