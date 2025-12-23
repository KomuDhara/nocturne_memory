import React, { useState, useCallback } from 'react';
import { Trash2, Search, AlertCircle, CheckCircle2, Loader2, HardDrive, Layers, Sparkles, Ghost } from 'lucide-react';
import clsx from 'clsx';
import { getOrphanStates, deleteStatesBatch, getOrphanEntities, deleteEntitiesBatch } from '../../lib/api';

function MaintenancePage() {
  // Tab: 'states' or 'entities'
  const [activeTab, setActiveTab] = useState('states');
  
  // State cleanup state
  const [stateMode, setStateMode] = useState('in_zero');
  const [stateLimit, setStateLimit] = useState(100);
  const [stateLoading, setStateLoading] = useState(false);
  const [stateDeleting, setStateDeleting] = useState(false);
  const [stateError, setStateError] = useState(null);
  const [orphanStates, setOrphanStates] = useState(null);
  const [selectedStateIds, setSelectedStateIds] = useState(new Set());
  const [stateDeleteResult, setStateDeleteResult] = useState(null);

  // Entity cleanup state
  const [entityLimit, setEntityLimit] = useState(100);
  const [entityLoading, setEntityLoading] = useState(false);
  const [entityDeleting, setEntityDeleting] = useState(false);
  const [entityError, setEntityError] = useState(null);
  const [orphanEntities, setOrphanEntities] = useState(null);
  const [selectedEntityIds, setSelectedEntityIds] = useState(new Set());
  const [entityDeleteResult, setEntityDeleteResult] = useState(null);

  // ========== State Cleanup Handlers ==========
  const handleSearchStates = useCallback(async () => {
    setStateLoading(true);
    setStateError(null);
    setStateDeleteResult(null);
    setSelectedStateIds(new Set());
    
    try {
      const data = await getOrphanStates(stateMode, stateLimit);
      setOrphanStates(data);
    } catch (err) {
      setStateError(err.response?.data?.detail || err.message || 'Failed to fetch orphan states');
      setOrphanStates(null);
    } finally {
      setStateLoading(false);
    }
  }, [stateMode, stateLimit]);

  const toggleStateSelection = (stateId) => {
    setSelectedStateIds(prev => {
      const next = new Set(prev);
      if (next.has(stateId)) {
        next.delete(stateId);
      } else {
        next.add(stateId);
      }
      return next;
    });
  };

  const selectAllStates = () => {
    if (!orphanStates?.states) return;
    const nonCurrentIds = orphanStates.states
      .filter(s => !s.is_current)
      .map(s => s.state_id);
    setSelectedStateIds(new Set(nonCurrentIds));
  };

  const handleDeleteStates = async () => {
    if (selectedStateIds.size === 0) return;
    
    const hasCurrent = orphanStates.states.some(s => selectedStateIds.has(s.state_id) && s.is_current);
    
    let message = `Delete ${selectedStateIds.size} state(s)? This cannot be undone.`;
    if (hasCurrent) {
      message += `\n\n⚠️ WARNING: You have selected CURRENT version(s).\nDeleting them will revert the entity to its previous version.`;
    }
    
    message += `\n\nSelected IDs:\n${[...selectedStateIds].slice(0, 5).join('\n')}` +
      (selectedStateIds.size > 5 ? `\n... and ${selectedStateIds.size - 5} more` : '');

    const confirmed = confirm(message);
    
    if (!confirmed) return;
    
    setStateDeleting(true);
    setStateError(null);
    setStateDeleteResult(null);
    
    try {
      const result = await deleteStatesBatch([...selectedStateIds]);
      setStateDeleteResult(result);
      
      if (result.deleted_count > 0) {
        const data = await getOrphanStates(stateMode, stateLimit);
        setOrphanStates(data);
        setSelectedStateIds(new Set());
      }
    } catch (err) {
      setStateError(err.response?.data?.detail || err.message || 'Failed to delete states');
    } finally {
      setStateDeleting(false);
    }
  };

  // ========== Entity Cleanup Handlers ==========
  const handleSearchEntities = useCallback(async () => {
    setEntityLoading(true);
    setEntityError(null);
    setEntityDeleteResult(null);
    setSelectedEntityIds(new Set());
    
    try {
      const data = await getOrphanEntities(entityLimit);
      setOrphanEntities(data);
    } catch (err) {
      setEntityError(err.response?.data?.detail || err.message || 'Failed to fetch orphan entities');
      setOrphanEntities(null);
    } finally {
      setEntityLoading(false);
    }
  }, [entityLimit]);

  const toggleEntitySelection = (entityId) => {
    setSelectedEntityIds(prev => {
      const next = new Set(prev);
      if (next.has(entityId)) {
        next.delete(entityId);
      } else {
        next.add(entityId);
      }
      return next;
    });
  };

  const selectAllEntities = () => {
    if (!orphanEntities?.entities) return;
    setSelectedEntityIds(new Set(orphanEntities.entities.map(e => e.entity_id)));
  };

  const handleDeleteEntities = async () => {
    if (selectedEntityIds.size === 0) return;
    
    let message = `Delete ${selectedEntityIds.size} entity(ies) permanently? This cannot be undone.\n\n灭它全家老小？`;
    
    message += `\n\nSelected IDs:\n${[...selectedEntityIds].slice(0, 5).join('\n')}` +
      (selectedEntityIds.size > 5 ? `\n... and ${selectedEntityIds.size - 5} more` : '');

    const confirmed = confirm(message);
    
    if (!confirmed) return;
    
    setEntityDeleting(true);
    setEntityError(null);
    setEntityDeleteResult(null);
    
    try {
      const result = await deleteEntitiesBatch([...selectedEntityIds]);
      setEntityDeleteResult(result);
      
      if (result.deleted_count > 0) {
        const data = await getOrphanEntities(entityLimit);
        setOrphanEntities(data);
        setSelectedEntityIds(new Set());
      }
    } catch (err) {
      setEntityError(err.response?.data?.detail || err.message || 'Failed to delete entities');
    } finally {
      setEntityDeleting(false);
    }
  };

  const getEntityTypeColor = (type) => {
    const colors = {
      'Character': 'text-rose-400 bg-rose-950/30',
      'Location': 'text-emerald-400 bg-emerald-950/30',
      'Faction': 'text-amber-400 bg-amber-950/30',
      'Event': 'text-sky-400 bg-sky-950/30',
      'Item': 'text-violet-400 bg-violet-950/30',
      'Relationship': 'text-pink-400 bg-pink-950/30',
    };
    return colors[type] || 'text-slate-400 bg-slate-800/30';
  };

  return (
    <div className="flex h-full bg-slate-950 text-slate-200 overflow-hidden font-sans">
      {/* Sidebar - Controls */}
      <div className="w-80 flex-shrink-0 border-r border-slate-800 flex flex-col bg-slate-900/50">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-900">
          <h1 className="text-lg font-bold text-amber-400 flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Brain Cleanup
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Find and remove unused nodes
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="p-2 border-b border-slate-800 flex gap-1">
          <button
            onClick={() => setActiveTab('states')}
            className={clsx(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === 'states'
                ? "bg-amber-900/50 text-amber-200 border border-amber-800"
                : "bg-slate-800/50 text-slate-400 hover:text-slate-300 hover:bg-slate-800"
            )}
          >
            <Layers size={14} />
            States
          </button>
          <button
            onClick={() => setActiveTab('entities')}
            className={clsx(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === 'entities'
                ? "bg-rose-900/50 text-rose-200 border border-rose-800"
                : "bg-slate-800/50 text-slate-400 hover:text-slate-300 hover:bg-slate-800"
            )}
          >
            <Ghost size={14} />
            Entities
          </button>
        </div>

        {/* State Cleanup Controls */}
        {activeTab === 'states' && (
          <>
            <div className="p-4 space-y-4 border-b border-slate-800">
              <div>
                <label className="text-xs text-slate-500 uppercase font-bold mb-2 block">
                  Mode
                </label>
                <select
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm focus:border-amber-500 outline-none"
                  value={stateMode}
                  onChange={(e) => setStateMode(e.target.value)}
                >
                  <option value="in_zero">No Incoming Edges (宽松)</option>
                  <option value="all_zero">No Edges At All (严格)</option>
                </select>
                <p className="text-xs text-slate-600 mt-1">
                  {stateMode === 'in_zero' 
                    ? '没有入边的 State（可能有出边但没人引用）' 
                    : '完全孤立的 State（无任何业务边）'}
                </p>
              </div>

              <div>
                <label className="text-xs text-slate-500 uppercase font-bold mb-2 block">
                  Limit
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm focus:border-amber-500 outline-none"
                  value={stateLimit}
                  onChange={(e) => setStateLimit(Math.max(1, Math.min(500, parseInt(e.target.value) || 100)))}
                />
              </div>

              <button
                onClick={handleSearchStates}
                disabled={stateLoading}
                className={clsx(
                  "w-full flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors",
                  stateLoading
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                    : "bg-amber-900/50 hover:bg-amber-800/50 text-amber-200 border border-amber-800"
                )}
              >
                {stateLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                {stateLoading ? 'Searching...' : 'Search Orphan States'}
              </button>
            </div>

            {/* Stats */}
            {orphanStates && (
              <div className="p-4 border-b border-slate-800">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-amber-400">{orphanStates.count}</div>
                    <div className="text-xs text-slate-500">Found</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-rose-400">{selectedStateIds.size}</div>
                    <div className="text-xs text-slate-500">Selected</div>
                  </div>
                </div>
              </div>
            )}

            {/* Selection Controls */}
            {orphanStates?.states?.length > 0 && (
              <div className="p-4 border-b border-slate-800 space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={selectAllStates}
                    className="flex-1 text-xs py-1.5 px-2 bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                  >
                    Select Non-Current
                  </button>
                  <button
                    onClick={() => setSelectedStateIds(new Set())}
                    className="flex-1 text-xs py-1.5 px-2 bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Delete Button */}
            {selectedStateIds.size > 0 && (
              <div className="p-4 border-t border-slate-800 bg-slate-900">
                <button
                  onClick={handleDeleteStates}
                  disabled={stateDeleting}
                  className={clsx(
                    "w-full flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors",
                    stateDeleting
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                      : "bg-rose-900/50 hover:bg-rose-800/50 text-rose-200 border border-rose-800"
                  )}
                >
                  {stateDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  {stateDeleting ? 'Deleting...' : `Delete ${selectedStateIds.size} State(s)`}
                </button>
              </div>
            )}
          </>
        )}

        {/* Entity Cleanup Controls */}
        {activeTab === 'entities' && (
          <>
            <div className="p-4 space-y-4 border-b border-slate-800">
              <div className="p-3 bg-rose-950/20 border border-rose-900/50 rounded-lg">
                <p className="text-xs text-rose-300/80">
                  <Ghost className="w-3 h-3 inline mr-1" />
                  孤儿 Entity 是没有任何 State 的光杆司令。
                  通常是删完所有 State 后留下的空壳。
                </p>
              </div>

              <div>
                <label className="text-xs text-slate-500 uppercase font-bold mb-2 block">
                  Limit
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm focus:border-rose-500 outline-none"
                  value={entityLimit}
                  onChange={(e) => setEntityLimit(Math.max(1, Math.min(500, parseInt(e.target.value) || 100)))}
                />
              </div>

              <button
                onClick={handleSearchEntities}
                disabled={entityLoading}
                className={clsx(
                  "w-full flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors",
                  entityLoading
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                    : "bg-rose-900/50 hover:bg-rose-800/50 text-rose-200 border border-rose-800"
                )}
              >
                {entityLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                {entityLoading ? 'Searching...' : 'Search Orphan Entities'}
              </button>
            </div>

            {/* Stats */}
            {orphanEntities && (
              <div className="p-4 border-b border-slate-800">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-rose-400">{orphanEntities.count}</div>
                    <div className="text-xs text-slate-500">Found</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-rose-400">{selectedEntityIds.size}</div>
                    <div className="text-xs text-slate-500">Selected</div>
                  </div>
                </div>
              </div>
            )}

            {/* Selection Controls */}
            {orphanEntities?.entities?.length > 0 && (
              <div className="p-4 border-b border-slate-800 space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={selectAllEntities}
                    className="flex-1 text-xs py-1.5 px-2 bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setSelectedEntityIds(new Set())}
                    className="flex-1 text-xs py-1.5 px-2 bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Delete Button */}
            {selectedEntityIds.size > 0 && (
              <div className="p-4 border-t border-slate-800 bg-slate-900">
                <button
                  onClick={handleDeleteEntities}
                  disabled={entityDeleting}
                  className={clsx(
                    "w-full flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors",
                    entityDeleting
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                      : "bg-rose-900/50 hover:bg-rose-800/50 text-rose-200 border border-rose-800"
                  )}
                >
                  {entityDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  {entityDeleting ? 'Deleting...' : `灭掉 ${selectedEntityIds.size} 个 Entity`}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
        {/* State Tab Content */}
        {activeTab === 'states' && (
          <>
            {/* Result Banner */}
            {stateDeleteResult && (
              <div className={clsx(
                "px-6 py-3 flex items-center gap-3 border-b",
                stateDeleteResult.failed_count === 0
                  ? "bg-emerald-950/30 border-emerald-900 text-emerald-300"
                  : "bg-amber-950/30 border-amber-900 text-amber-300"
              )}>
                {stateDeleteResult.failed_count === 0 ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <AlertCircle size={18} />
                )}
                <span className="text-sm">
                  Deleted {stateDeleteResult.deleted_count} state(s).
                  {stateDeleteResult.failed_count > 0 && (
                    <span className="text-rose-400 ml-2">
                      {stateDeleteResult.failed_count} failed.
                    </span>
                  )}
                </span>
                {stateDeleteResult.failed?.length > 0 && (
                  <button
                    onClick={() => alert(stateDeleteResult.failed.map(f => `${f.state_id}: ${f.error}`).join('\n'))}
                    className="ml-auto text-xs underline hover:no-underline"
                  >
                    View Errors
                  </button>
                )}
              </div>
            )}

            {/* Error Banner */}
            {stateError && (
              <div className="px-6 py-3 bg-rose-950/30 border-b border-rose-900 text-rose-300 flex items-center gap-3">
                <AlertCircle size={18} />
                <span className="text-sm">{stateError}</span>
              </div>
            )}

            {/* State List */}
            <div className="flex-1 overflow-y-auto p-6">
              {!orphanStates ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-4">
                  <HardDrive size={64} className="opacity-20" />
                  <p>Click "Search Orphan States" to find unused states</p>
                  <p className="text-xs text-slate-700 max-w-md text-center">
                    This tool helps you clean up old State versions that are no longer 
                    referenced by any edges. Think of it as taking out the garbage from 
                    Nocturne's memory.
                  </p>
                </div>
              ) : orphanStates.states.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-emerald-600 gap-4">
                  <CheckCircle2 size={64} className="opacity-40" />
                  <p>No orphan states found!</p>
                  <p className="text-xs text-slate-600">Memory is clean ✨</p>
                </div>
              ) : (
                <div className="max-w-5xl mx-auto space-y-2">
                  {orphanStates.states.map((state) => (
                    <div
                      key={state.state_id}
                      onClick={() => toggleStateSelection(state.state_id)}
                      className={clsx(
                        "flex items-start gap-4 p-4 rounded-lg border transition-all cursor-pointer",
                        selectedStateIds.has(state.state_id)
                          ? "bg-rose-950/20 border-rose-800"
                          : state.is_current
                            ? "bg-amber-950/10 border-slate-800 hover:border-amber-800/50"
                            : "bg-slate-900/30 border-slate-800 hover:border-slate-700"
                      )}
                    >
                      {/* Checkbox */}
                      <div className="pt-0.5">
                        <div className={clsx(
                          "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                          selectedStateIds.has(state.state_id)
                            ? "border-rose-500 bg-rose-500"
                            : state.is_current
                              ? "border-slate-700 bg-slate-800/50"
                              : "border-slate-600 hover:border-slate-500"
                        )}>
                          {selectedStateIds.has(state.state_id) && (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                              <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                            </svg>
                          )}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm text-slate-300">
                            {state.state_id}
                          </span>
                          <span className={clsx(
                            "text-xs px-2 py-0.5 rounded-full",
                            getEntityTypeColor(state.entity_type)
                          )}>
                            {state.entity_type}
                          </span>
                          {state.is_current && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-950/50 text-indigo-400 border border-indigo-800">
                              CURRENT
                            </span>
                          )}
                        </div>
                        
                        <div className="text-sm text-slate-400 mb-2">
                          <span className="font-medium text-slate-300">{state.name}</span>
                          <span className="mx-2 text-slate-600">•</span>
                          <span>v{state.version}</span>
                          <span className="mx-2 text-slate-600">•</span>
                          <span className="text-xs">
                            in:{state.in_count} out:{state.out_count}
                          </span>
                        </div>
                        
                        <p className="text-xs text-slate-500 line-clamp-2 font-mono">
                          {state.content_snippet || '(empty content)'}
                        </p>
                      </div>

                      {/* Layers icon to show version */}
                      <div className="flex flex-col items-center text-slate-600">
                        <Layers size={16} />
                        <span className="text-xs mt-1">v{state.version}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Entity Tab Content */}
        {activeTab === 'entities' && (
          <>
            {/* Result Banner */}
            {entityDeleteResult && (
              <div className={clsx(
                "px-6 py-3 flex items-center gap-3 border-b",
                entityDeleteResult.failed_count === 0
                  ? "bg-emerald-950/30 border-emerald-900 text-emerald-300"
                  : "bg-amber-950/30 border-amber-900 text-amber-300"
              )}>
                {entityDeleteResult.failed_count === 0 ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <AlertCircle size={18} />
                )}
                <span className="text-sm">
                  灭掉了 {entityDeleteResult.deleted_count} 个 entity.
                  {entityDeleteResult.failed_count > 0 && (
                    <span className="text-rose-400 ml-2">
                      {entityDeleteResult.failed_count} 个失败了.
                    </span>
                  )}
                </span>
                {entityDeleteResult.failed?.length > 0 && (
                  <button
                    onClick={() => alert(entityDeleteResult.failed.map(f => `${f.entity_id}: ${f.error}`).join('\n'))}
                    className="ml-auto text-xs underline hover:no-underline"
                  >
                    View Errors
                  </button>
                )}
              </div>
            )}

            {/* Error Banner */}
            {entityError && (
              <div className="px-6 py-3 bg-rose-950/30 border-b border-rose-900 text-rose-300 flex items-center gap-3">
                <AlertCircle size={18} />
                <span className="text-sm">{entityError}</span>
              </div>
            )}

            {/* Entity List */}
            <div className="flex-1 overflow-y-auto p-6">
              {!orphanEntities ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-4">
                  <Ghost size={64} className="opacity-20" />
                  <p>Click "Search Orphan Entities" to find empty shells</p>
                  <p className="text-xs text-slate-700 max-w-md text-center">
                    孤儿 Entity 是删完所有 State 后剩下的空壳。
                    它们就像没有灵魂的躯壳，占着茅坑不拉屎。
                    先用 States tab 删完无用的 State，再来这里处决光杆司令。
                  </p>
                </div>
              ) : orphanEntities.entities.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-emerald-600 gap-4">
                  <CheckCircle2 size={64} className="opacity-40" />
                  <p>No orphan entities found!</p>
                  <p className="text-xs text-slate-600">所有 Entity 都有 State 在守护 ✨</p>
                </div>
              ) : (
                <div className="max-w-5xl mx-auto space-y-2">
                  {orphanEntities.entities.map((entity) => (
                    <div
                      key={entity.entity_id}
                      onClick={() => toggleEntitySelection(entity.entity_id)}
                      className={clsx(
                        "flex items-start gap-4 p-4 rounded-lg border transition-all cursor-pointer",
                        selectedEntityIds.has(entity.entity_id)
                          ? "bg-rose-950/20 border-rose-800"
                          : "bg-slate-900/30 border-slate-800 hover:border-slate-700"
                      )}
                    >
                      {/* Checkbox */}
                      <div className="pt-0.5">
                        <div className={clsx(
                          "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                          selectedEntityIds.has(entity.entity_id)
                            ? "border-rose-500 bg-rose-500"
                            : "border-slate-600 hover:border-slate-500"
                        )}>
                          {selectedEntityIds.has(entity.entity_id) && (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                              <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                            </svg>
                          )}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm text-slate-300">
                            {entity.entity_id}
                          </span>
                          <span className={clsx(
                            "text-xs px-2 py-0.5 rounded-full",
                            getEntityTypeColor(entity.node_type)
                          )}>
                            {entity.node_type}
                          </span>
                        </div>
                        
                        <div className="text-sm text-slate-400">
                          <span className="font-medium text-slate-300">{entity.name}</span>
                        </div>
                      </div>

                      {/* Ghost icon */}
                      <div className="flex flex-col items-center text-slate-600">
                        <Ghost size={16} />
                        <span className="text-xs mt-1">空壳</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default MaintenancePage;
