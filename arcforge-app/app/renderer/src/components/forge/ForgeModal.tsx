/**
 * Forge Modal — multi-step wizard for blueprint selection, params, preview, and execution.
 * Steps: select → params → preview → executing → done.
 * Blueprints are grouped by category; Templates first, then collapsible categories.
 * Search filters across all blueprints; when active, categories are hidden.
 */

import React, { useEffect, useCallback, useState, useMemo } from 'react';
import { useForgeStore } from '../../store/forgeStore';
import { usePendingChangesStore } from '../../store/pendingChangesStore';
import { useGraphStore } from '../../store/graphStore';
import { useNotificationStore } from '../../store/notificationStore';
import type { ForgeBlueprintInfo } from '../../global';

declare const window: Window & { arcforge?: import('../../global').ArcforgeAPI };

const FORGE_CATEGORY_COLLAPSED_KEY = 'arcforge:forge:categoryCollapsed';

function matchesSearch(bp: ForgeBlueprintInfo, q: string): boolean {
  if (!q.trim()) return true;
  const lower = q.toLowerCase().trim();
  return (
    bp.displayName.toLowerCase().includes(lower) ||
    bp.description.toLowerCase().includes(lower) ||
    (bp.category ?? '').toLowerCase().includes(lower)
  );
}

function ForgeBlueprintList({
  blueprints,
  searchQuery,
  categoryCollapsed,
  toggleCategory,
  selectBlueprint,
}: {
  blueprints: ForgeBlueprintInfo[];
  searchQuery: string;
  categoryCollapsed: Record<string, boolean>;
  toggleCategory: (cat: string) => void;
  selectBlueprint: (bp: ForgeBlueprintInfo) => void;
}) {
  const filtered = useMemo(
    () => (searchQuery.trim() ? blueprints.filter((bp) => matchesSearch(bp, searchQuery)) : blueprints),
    [blueprints, searchQuery]
  );

  const byCategory = useMemo(() => {
    const map = new Map<string, ForgeBlueprintInfo[]>();
    for (const bp of filtered) {
      const cat = bp.category ?? 'General';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(bp);
    }
    const templates = map.get('Templates');
    const rest = Array.from(map.entries()).filter(([c]) => c !== 'Templates');
    rest.sort((a, b) => a[0].localeCompare(b[0]));
    const order: [string, ForgeBlueprintInfo[]][] = [];
    if (templates) order.push(['Templates', templates]);
    for (const [cat, list] of rest) order.push([cat, list]);
    return order;
  }, [filtered]);

  const isSearchMode = searchQuery.trim().length > 0;

  if (filtered.length === 0) {
    return <div className="forge-empty">No blueprints match &quot;{searchQuery}&quot;</div>;
  }

  if (isSearchMode) {
    return (
      <div className="forge-blueprint-list">
        {filtered.map((bp) => (
          <button
            key={bp.name}
            className="forge-blueprint-item"
            onClick={() => selectBlueprint(bp)}
          >
            <span className="forge-blueprint-name">{bp.displayName}</span>
            <span className="forge-blueprint-desc">{bp.description}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="forge-category-list">
      {byCategory.map(([category, list]) => {
        // Default: all categories collapsed; only Templates expanded
        const collapsed = categoryCollapsed[category] ?? (category !== 'Templates');
        return (
          <div key={category} className="forge-category">
            <button
              type="button"
              className="forge-category-header"
              onClick={() => toggleCategory(category)}
              aria-expanded={!collapsed}
            >
              <span className="forge-category-chevron">{collapsed ? '▶' : '▼'}</span>
              <span className="forge-category-title">{category}</span>
              <span className="forge-category-count">({list.length})</span>
            </button>
            {!collapsed && (
              <div className="forge-blueprint-list">
                {list.map((bp) => (
                  <button
                    key={bp.name}
                    className="forge-blueprint-item"
                    onClick={() => selectBlueprint(bp)}
                  >
                    <span className="forge-blueprint-name">{bp.displayName}</span>
                    <span className="forge-blueprint-desc">{bp.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export interface ForgeModalProps {
  /** Called when a Forge execution completes (e.g. to refresh undo stack). */
  onDone?: () => void;
}

export const ForgeModal: React.FC<ForgeModalProps> = ({ onDone }) => {
  const {
    step,
    sourceNode,
    blueprints,
    selectedBlueprint,
    params,
    preview,
    result,
    error,
    setBlueprints,
    selectBlueprint,
    setParam,
    goToPreview,
    setPreview,
    startExecuting,
    setResult,
    setError,
    goBack,
    closeForge,
  } = useForgeStore();

  const setPending = usePendingChangesStore((s) => s.setPending);
  const projectPath = useGraphStore((s) => s.projectPath);
  const addNotification = useNotificationStore((s) => s.add);
  const [migrating, setMigrating] = useState(false);
  const [openedParamHints, setOpenedParamHints] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryCollapsed, setCategoryCollapsed] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(FORGE_CATEGORY_COLLAPSED_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, boolean>;
        return typeof parsed === 'object' ? parsed : {};
      }
    } catch {
      /* ignore */
    }
    return {};
  });

  const persistCategoryCollapsed = useCallback((next: Record<string, boolean>) => {
    setCategoryCollapsed(next);
    try {
      localStorage.setItem(FORGE_CATEGORY_COLLAPSED_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCategory = useCallback(
    (cat: string) => {
      persistCategoryCollapsed((prev) => {
        const effectiveCollapsed = prev[cat] ?? (cat !== 'Templates');
        return { ...prev, [cat]: !effectiveCollapsed };
      });
    },
    [persistCategoryCollapsed]
  );

  // Fetch blueprints when modal opens (select step)
  useEffect(() => {
    if (step !== 'select' || !sourceNode) return;
    const api = window.arcforge;
    if (!api?.forge) return;
    api.forge.getBlueprints(sourceNode.type).then(setBlueprints).catch(() => setBlueprints([]));
  }, [step, sourceNode, setBlueprints]);

  // Reset search when opening select step
  useEffect(() => {
    if (step === 'select') setSearchQuery('');
  }, [step]);

  // Fetch preview when entering preview step
  useEffect(() => {
    if (step !== 'preview' || !selectedBlueprint || !sourceNode) return;
    const api = window.arcforge;
    if (!api?.forge) return;
    api.forge
      .preview(selectedBlueprint.name, sourceNode.id, params)
      .then((res) => {
        if (res.ok && res.preview) setPreview(res.preview);
        else setError(res.error ?? 'Preview failed');
      })
      .catch((err) => setError(String(err)));
  }, [step, selectedBlueprint, sourceNode, params, setPreview, setError]);

  const handleExecute = useCallback(() => {
    if (!selectedBlueprint || !sourceNode) return;
    const api = window.arcforge;
    if (!api?.forge) return;
    startExecuting();
    api.forge
      .execute(selectedBlueprint.name, sourceNode.id, params)
      .then((res) => {
        if (res.ok && res.result) {
          setResult(res.result);
          if (res.pendingDiffs && res.pendingDiffs.length > 0 && res.result.backupId) {
            setPending(res.result.backupId, res.pendingDiffs);
          }
          onDone?.();
        } else setError(res.error ?? 'Execution failed');
      })
      .catch((err) => setError(String(err)));
  }, [selectedBlueprint, sourceNode, params, startExecuting, setResult, setError, onDone, setPending]);

  const handleRollback = useCallback(() => {
    if (!result?.backupId) return;
    const api = window.arcforge;
    if (!api?.forge) return;
    api.forge.rollback(result.backupId).then(() => closeForge());
  }, [result, closeForge]);

  const handleRunMigrations = useCallback(async () => {
    if (!projectPath || !window.arcforge?.shell) return;
    setMigrating(true);
    try {
      const res = await window.arcforge.shell.run(projectPath, 'php artisan migrate');
      const out = [res.stdout, res.stderr].filter(Boolean).join('\n').trim();
      if (res.ok) {
        addNotification('success', out || 'Migrations completed.');
      } else {
        addNotification('error', res.error ?? out ?? 'Migration failed.');
      }
    } catch (err) {
      addNotification('error', err instanceof Error ? err.message : String(err));
    } finally {
      setMigrating(false);
    }
  }, [projectPath, addNotification]);

  if (step === 'closed') return null;

  const METHOD_BINDING_MAP: Record<string, string> = {
    'add-service': 'methodServiceBindings',
    'add-job': 'methodJobBindings',
    'add-resource': 'methodResourceBindings',
    'add-event': 'methodEventBindings',
    'service-add-model': 'methodModelBindings',
    'service-add-repository': 'methodRepositoryBindings',
    'service-add-service': 'methodServiceBindings',
    'service-add-event': 'methodEventBindings',
    'service-add-job': 'methodJobBindings',
    'repo-add-model': 'methodModelBindings',
  };

  const isMethodBindingBlueprint = !!(selectedBlueprint?.name && METHOD_BINDING_MAP[selectedBlueprint.name]);
  const methodBindingMetaKey = (selectedBlueprint?.name && METHOD_BINDING_MAP[selectedBlueprint.name]) ?? '';

  const isMethodBindingSource = sourceNode?.type === 'controller' || sourceNode?.type === 'service' || sourceNode?.type === 'repository';

  const sourceMethods = (() => {
    if (!sourceNode || !isMethodBindingSource) return [] as string[];
    const raw = (sourceNode.metadata as Record<string, unknown> | undefined)?.methods;
    if (!Array.isArray(raw)) return [] as string[];
    return raw.filter((m): m is string => typeof m === 'string' && m !== '__construct');
  })();

  const boundMethods = (() => {
    if (!sourceNode || !isMethodBindingSource || !methodBindingMetaKey) return new Set<string>();
    const raw = (sourceNode.metadata as Record<string, unknown> | undefined)?.[methodBindingMetaKey];
    if (!Array.isArray(raw)) return new Set<string>();
    const out = new Set<string>();
    for (const entry of raw) {
      if (!entry || typeof entry !== 'object') continue;
      const method = (entry as Record<string, unknown>).method;
      if (typeof method === 'string' && method) out.add(method);
    }
    return out;
  })();

  const freeMethods = sourceMethods.filter((m) => !boundMethods.has(m));

  const shouldHideTargetMethod =
    isMethodBindingBlueprint && isMethodBindingSource && freeMethods.length <= 1;
  const shouldHideNewMethodName =
    isMethodBindingBlueprint && isMethodBindingSource && freeMethods.length > 0;

  const methodBindingHint =
    isMethodBindingBlueprint && isMethodBindingSource
      ? freeMethods.length === 0
        ? 'All existing methods are already bound. Enter "New method name" to create a method for this new connection.'
        : freeMethods.length === 1
          ? `Only one free method found: "${freeMethods[0]}". It will be selected automatically.`
          : `Choose one free method for this connection: ${freeMethods.join(', ')}.`
      : null;

  const parseParamLabel = (label: string): { text: string; hint: string | null } => {
    const m = label.match(/^(.+?)\s*\(([^()]+)\)\s*$/);
    if (!m) return { text: label, hint: null };
    return { text: m[1].trim(), hint: m[2].trim() };
  };

  // Group params by category for Create Route and other blueprints that use categories
  const paramsByCategory = selectedBlueprint
    ? (() => {
        const groups = new Map<string | undefined, typeof selectedBlueprint.params>();
        for (const p of selectedBlueprint.params) {
          const cat = p.category ?? '';
          if (!groups.has(cat)) groups.set(cat, []);
          groups.get(cat)!.push(p);
        }
        return groups;
      })()
    : null;

  return (
    <div className="forge-modal-overlay" onClick={closeForge}>
      <div className="forge-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="forge-modal-header">
          <span className="forge-modal-title">
            {step === 'select' && 'Forge — Select Blueprint'}
            {step === 'params' && `Forge — ${selectedBlueprint?.displayName}`}
            {step === 'preview' && 'Forge — Preview'}
            {step === 'executing' && 'Forge — Executing...'}
            {step === 'done' && 'Forge — Complete'}
          </span>
          <button className="forge-modal-close" onClick={closeForge} title="Close">
            ✕
          </button>
        </div>

        {/* Source node badge */}
        {sourceNode && (
          <div className="forge-source-badge">
            <span className="forge-source-type">{sourceNode.type}</span>
            <span className="forge-source-label">{sourceNode.label}</span>
          </div>
        )}

        {/* Error bar */}
        {error && <div className="forge-error">{error}</div>}

        {/* Step: Select blueprint */}
        {step === 'select' && (
          <div className="forge-step-content forge-select-step">
            {blueprints.length === 0 ? (
              <div className="forge-empty">No blueprints available for this node type.</div>
            ) : (
              <>
                <div className="forge-search-wrap">
                  <input
                    type="text"
                    className="forge-search-input"
                    placeholder="Search blueprints…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                </div>
                <ForgeBlueprintList
                  blueprints={blueprints}
                  searchQuery={searchQuery}
                  categoryCollapsed={categoryCollapsed}
                  toggleCategory={toggleCategory}
                  selectBlueprint={selectBlueprint}
                />
              </>
            )}
          </div>
        )}

        {/* Step: Params (with optional category grouping) */}
        {step === 'params' && selectedBlueprint && (
          <div className="forge-step-content">
            <p className="forge-step-hint">{selectedBlueprint.description}</p>
            {methodBindingHint && <p className="forge-step-hint">{methodBindingHint}</p>}
            <div className="forge-params-form">
              {paramsByCategory &&
                Array.from(paramsByCategory.entries()).map(([category, paramsList]) => (
                  <div key={category || '_default'} className="forge-params-group">
                    {category && (
                      <div className="forge-param-category-label">{category}</div>
                    )}
                    {paramsList.map((p) => {
                      if (p.name === 'targetMethod' && shouldHideTargetMethod) return null;
                      if (p.name === 'newMethodName' && shouldHideNewMethodName) return null;
                      const quickSuggestions =
                        p.name === 'targetMethod' &&
                        isMethodBindingBlueprint &&
                        isMethodBindingSource &&
                        freeMethods.length > 1
                          ? freeMethods
                          : p.quickSuggestions;
                      const parsedLabel = parseParamLabel(p.label);
                      return (
                      <label key={p.name} className="forge-param-label">
                        <span>
                          {parsedLabel.text}
                          {parsedLabel.hint && (
                            <button
                              type="button"
                              className="forge-param-help"
                              title={parsedLabel.hint}
                              aria-label={parsedLabel.hint}
                              aria-expanded={!!openedParamHints[p.name]}
                              onClick={() =>
                                setOpenedParamHints((prev) => ({
                                  ...prev,
                                  [p.name]: !prev[p.name],
                                }))
                              }
                            >
                              ?
                            </button>
                          )}
                          {p.required && <span className="forge-required"> *</span>}
                        </span>
                        {parsedLabel.hint && openedParamHints[p.name] && (
                          <span className="forge-param-help-text">{parsedLabel.hint}</span>
                        )}
                        <input
                          className="forge-param-input"
                          type="text"
                          value={params[p.name] ?? ''}
                          onChange={(e) => setParam(p.name, e.target.value)}
                          placeholder={p.default ?? ''}
                        />
                        {quickSuggestions && quickSuggestions.length > 0 && (
                          <div className="forge-param-quicks">
                            {quickSuggestions.map((val) => (
                              <button
                                key={val}
                                type="button"
                                className="forge-quick-btn"
                                onClick={() => setParam(p.name, val)}
                                title={`Set to ${val}`}
                              >
                                {val}
                              </button>
                            ))}
                          </div>
                        )}
                      </label>
                    );})}
                  </div>
                ))}
            </div>
            <div className="forge-actions">
              <button className="forge-btn forge-btn-secondary" onClick={goBack}>
                Back
              </button>
              <button className="forge-btn forge-btn-primary" onClick={goToPreview}>
                Preview
              </button>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && (
          <div className="forge-step-content">
            {!preview ? (
              <div className="forge-loading">Generating preview...</div>
            ) : (
              <>
                {preview.validation.warnings.length > 0 && (
                  <div className="forge-warnings">
                    {preview.validation.warnings.map((w, i) => (
                      <div key={i} className="forge-warning-item">⚠ {w}</div>
                    ))}
                  </div>
                )}
                {preview.validation.errors.length > 0 && (
                  <div className="forge-warnings">
                    {preview.validation.errors.map((err, i) => (
                      <div key={i} className="forge-warning-item">✖ {err}</div>
                    ))}
                  </div>
                )}
                {preview.mutations.length === 0 && (!preview.graphMutations?.newNodes?.length) ? (
                  <div className="forge-empty">
                    Nothing to generate — all files already exist.
                  </div>
                ) : (
                  <div className="forge-mutation-list">
                    {preview.mutations.map((m, i) => (
                      <div key={i} className="forge-mutation-item">
                        <span className={`forge-mutation-type forge-mutation-${m.type}`}>
                          {m.type}
                        </span>
                        <span className="forge-mutation-path">{m.filePath}</span>
                        <span className="forge-mutation-desc">{m.description}</span>
                      </div>
                    ))}
                    {(preview.graphMutations?.newNodes?.length ?? 0) > 0 &&
                      preview.graphMutations!.newNodes.map((n, i) => (
                        <div key={`node-${i}`} className="forge-mutation-item">
                          <span className="forge-mutation-type forge-mutation-create">graph</span>
                          <span className="forge-mutation-path">
                            Add {n.type.replace('arch_', '')}: {n.label}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
                <div className="forge-actions">
                  <button className="forge-btn forge-btn-secondary" onClick={goBack}>
                    Back
                  </button>
                  {(preview.mutations.length > 0 || (preview.graphMutations?.newNodes?.length ?? 0) > 0) &&
                    preview.validation.errors.length === 0 && (
                      <button className="forge-btn forge-btn-primary" onClick={handleExecute}>
                        Confirm &amp; Generate
                      </button>
                    )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Step: Executing */}
        {step === 'executing' && (
          <div className="forge-step-content">
            <div className="forge-loading">Generating files...</div>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && result && (
          <div className="forge-step-content">
            {result.success ? (
              <>
                <div className="forge-success">
                  {result.mutations.length > 0
                    ? `Generated ${result.mutations.length} file(s) successfully.`
                    : (result.graphMutations?.newNodes?.length ?? 0) > 0
                      ? `Added ${result.graphMutations!.newNodes.length} node(s) successfully.`
                      : 'Done.'}
                </div>
                <div className="forge-mutation-list">
                  {result.mutations.map((m, i) => (
                    <div key={i} className="forge-mutation-item">
                      <span className={`forge-mutation-type forge-mutation-${m.type}`}>
                        {m.type}
                      </span>
                      <span className="forge-mutation-path">{m.filePath}</span>
                    </div>
                    ))}
                  {(result.graphMutations?.newNodes?.length ?? 0) > 0 &&
                    result.graphMutations!.newNodes.map((n, i) => (
                      <div key={`node-${i}`} className="forge-mutation-item">
                        <span className="forge-mutation-type forge-mutation-create">graph</span>
                        <span className="forge-mutation-path">
                          {n.type.replace('arch_', '')}: {n.label}
                        </span>
                      </div>
                    ))}
                </div>
                <div className="forge-actions">
                  {selectedBlueprint?.name === 'crud-flow' && projectPath && (
                    <button
                      className="forge-btn forge-btn-secondary"
                      onClick={handleRunMigrations}
                      disabled={migrating}
                      title="Run php artisan migrate in project"
                    >
                      {migrating ? 'Running…' : 'Run migrations now'}
                    </button>
                  )}
                  <button className="forge-btn forge-btn-secondary" onClick={handleRollback}>
                    Undo (Rollback)
                  </button>
                  <button className="forge-btn forge-btn-primary" onClick={closeForge}>
                    Done
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="forge-error">
                  Generation failed: {result.errors?.join(', ')}
                </div>
                <div className="forge-actions">
                  <button className="forge-btn forge-btn-secondary" onClick={closeForge}>
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
