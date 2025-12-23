import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  getEntityInfo, 
  getState, 
  deleteState, 
  deleteEntity,
  updateEntity,
  linkParent,
  unlinkParent
} from '../../lib/api';
import { Clock, Tag, FileText, ArrowRight, Trash2, Layers, Pencil, Save, X, FolderTree, Plus, Unlink } from 'lucide-react';
import { format } from 'date-fns';

export default function EntityDetail() {
  const { entityId } = useParams();
  const navigate = useNavigate();
  
  const [currentContent, setCurrentContent] = useState(null); // The content of the selected state
  const [versions, setVersions] = useState([]);
  const [selectedStateId, setSelectedStateId] = useState(null);
  const [stateStats, setStateStats] = useState(null);
  const [contentError, setContentError] = useState(null);
  const [versionsError, setVersionsError] = useState(null);
  const stateRequestRef = useRef(0); // Tracks latest state detail request to avoid stale updates
  const versionsRequestRef = useRef(0); // Tracks latest versions fetch
  
  const [loading, setLoading] = useState(true);
  const [outboundEdges, setOutboundEdges] = useState([]);
  const [children, setChildren] = useState([]);
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Child management state
  const [showAddChild, setShowAddChild] = useState(false);
  const [newChildId, setNewChildId] = useState('');
  const [addingChild, setAddingChild] = useState(false);
  
  // Load initial data (versions list)
  useEffect(() => {
    // Reset edit mode when switching entities
    setIsEditing(false);
    setEditContent('');
    setEditName('');
    loadVersions();
  }, [entityId]);

  // Ensure async callbacks can know the latest entityId
  const entityIdRef = useRef(entityId);
  useEffect(() => {
    entityIdRef.current = entityId;
  }, [entityId]);

  // When selected state changes, load its details and stats
  useEffect(() => {
    if (selectedStateId) {
      loadStateDetails(selectedStateId);
    }
  }, [selectedStateId]);

  const loadVersions = async () => {
    const requestId = ++versionsRequestRef.current;
    const targetEntityId = entityId;
    setLoading(true);
    setVersionsError(null);
    setContentError(null);
    setOutboundEdges([]);
    setChildren([]);
    try {
      // 1. Get all info (basic, history, edges, children) in one go
      const info = await getEntityInfo(targetEntityId);
      
      if (requestId !== versionsRequestRef.current || entityIdRef.current !== targetEntityId) {
        return;
      }
      
      setVersions(info.history || []);
      setOutboundEdges(info.edges || []);
      setChildren(info.children || []);

      const nextStateId = info.history?.[0]?.state_id;

      if (!nextStateId) {
        // No states, stop loading and clear content
        setCurrentContent(null);
        setContentError(null);
        setSelectedStateId(null);
        setStateStats(null);
        setLoading(false);
        return;
      }

      // 3. If the latest version is already selected, load details directly; otherwise let the effect handle it
      if (nextStateId === selectedStateId) {
        await loadStateDetails(nextStateId);
      } else {
        setSelectedStateId(nextStateId);
      }
    } catch (err) {
      console.error(err);
      if (requestId !== versionsRequestRef.current || entityIdRef.current !== targetEntityId) {
        return;
      }
      setVersions([]);
      setCurrentContent(null);
      setSelectedStateId(null);
      setStateStats(null);
      setOutboundEdges([]);
      setChildren([]);
      setContentError(null);
      setVersionsError(err?.message || 'Failed to load entity info.');
      setLoading(false);
    }
  };

  const loadStateDetails = async (stateId) => {
    const requestId = ++stateRequestRef.current; // mark this call as the newest
    setContentError(null);
    setStateStats(null);
    try {
      const contentData = await getState(stateId);
      // Ignore stale responses if another state was selected meanwhile
      if (requestId !== stateRequestRef.current) return;
      setCurrentContent(contentData);
      setContentError(null);
      setStateStats({
        in_count: typeof contentData?.in_count === 'number' ? contentData.in_count : 0,
        out_count: typeof contentData?.out_count === 'number' ? contentData.out_count : 0
      });
    } catch (err) {
      if (requestId !== stateRequestRef.current) return;
      console.error("Failed to load state details", err);
      setCurrentContent(null);
      setContentError(err?.message || "Failed to load state details.");
    } finally {
      if (requestId === stateRequestRef.current) {
        setLoading(false);
      }
    }
  };

  const handleDeleteState = async () => {
    if (!selectedStateId) return;
    
    if (stateStats?.in_count > 0) {
      alert(`Cannot delete this state because it has ${stateStats.in_count} incoming dependencies.`);
      return;
    }

    if (!window.confirm(`Are you sure you want to delete version ${currentContent?.version}?`)) {
      return;
    }

    try {
      await deleteState(selectedStateId);
      // Reload versions
      loadVersions(); 
      // If we deleted the selected one, loadVersions will reset selection to the new first one
    } catch (err) {
      alert(`Failed to delete state: ${err.message}`);
    }
  };

  const handleDeleteEntity = async () => {
    if (versions.length > 0) {
      alert("Cannot delete entity while it still has states. Delete all states first.");
      return;
    }

    if (!window.confirm(`Are you sure you want to PERMANENTLY delete entity ${entityId}?`)) {
      return;
    }

    try {
      await deleteEntity(entityId);
      alert("Entity deleted.");
      navigate('/memory/catalog'); // Go back to catalog
    } catch (err) {
      alert(`Failed to delete entity: ${err.message}`);
    }
  };

  // Edit handlers
  const startEdit = () => {
    setEditContent(currentContent?.content || '');
    setEditName(currentContent?.name || '');
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditContent('');
    setEditName('');
  };

  const saveEdit = async () => {
    if (!editContent.trim()) {
      alert('Content cannot be empty');
      return;
    }
    
    setSaving(true);
    try {
      const nameChanged = editName !== currentContent?.name;
      await updateEntity(
        entityId, 
        editContent, 
        nameChanged ? editName : null
      );
      setIsEditing(false);
      loadVersions(); // Reload to show new version
    } catch (err) {
      alert(`Failed to save: ${err.response?.data?.detail || err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Child management handlers
  const handleAddChild = async () => {
    if (!newChildId.trim()) {
      alert('Please enter a child entity ID');
      return;
    }
    
    setAddingChild(true);
    try {
      await linkParent(newChildId.trim(), entityId);
      setNewChildId('');
      setShowAddChild(false);
      loadVersions(); // Reload to show new child
    } catch (err) {
      alert(`Failed to add child: ${err.response?.data?.detail || err.message}`);
    } finally {
      setAddingChild(false);
    }
  };

  const handleUnlinkChild = async (childId, childName) => {
    if (!window.confirm(`Remove "${childName}" from children of this entity?`)) {
      return;
    }
    
    try {
      await unlinkParent(childId, entityId);
      loadVersions(); // Reload to update children list
    } catch (err) {
      alert(`Failed to unlink child: ${err.response?.data?.detail || err.message}`);
    }
  };

  const isLoadingContent = loading || (!currentContent && versions.length > 0 && !contentError);

  if (versionsError) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="text-red-300">加载 Entity 版本列表失败：{versionsError}</div>
        <button
          onClick={() => loadVersions()}
          className="px-4 py-2 bg-emerald-900/50 text-emerald-200 rounded border border-emerald-800 hover:bg-emerald-900 transition-colors"
        >
          重试
        </button>
      </div>
    );
  }

  if (isLoadingContent) return <div className="p-8 text-center text-slate-500">Loading entity...</div>;

  if (contentError) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="text-red-300">加载 State 失败：{contentError}</div>
        <button
          onClick={() => {
            if (selectedStateId) {
              setLoading(true);
              loadStateDetails(selectedStateId);
            }
          }}
          className="px-4 py-2 bg-emerald-900/50 text-emerald-200 rounded border border-emerald-800 hover:bg-emerald-900 transition-colors"
        >
          重试加载
        </button>
      </div>
    );
  }

  // Case: Entity exists but no states (rare, but possible if all states deleted)
  if (!loading && versions.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="text-slate-500 mb-4">Entity {entityId} has no states.</div>
        <button 
          onClick={handleDeleteEntity}
          className="px-4 py-2 bg-red-900/50 text-red-200 rounded border border-red-800 hover:bg-red-900 transition-colors"
        >
          Delete Entity
        </button>
      </div>
    );
  }

  if (!currentContent) return <div className="p-8 text-center text-slate-500">Entity not found</div>;

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="pb-6 border-b border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2 text-slate-500 text-sm font-mono">
              <Tag size={14} />
              <span>{entityId}</span>
            </div>

            {/* Version Selector */}
            <div className="flex items-center gap-2">
              <Layers size={14} className="text-slate-500" />
              <select 
                value={selectedStateId || ''}
                onChange={(e) => setSelectedStateId(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded px-2 py-1 focus:outline-none focus:border-emerald-500"
              >
                 {versions.map(v => (
                   <option key={v.state_id} value={v.state_id}>
                     v{v.version} ({format(new Date(v.created_at), 'MM-dd HH:mm')})
                   </option>
                 ))}
               </select>
             </div>
          </div>

          <h1 className="text-3xl font-bold text-slate-100 mb-4">{currentContent.name || entityId}</h1>
          
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4 text-xs text-slate-500">
                <div className="flex items-center gap-1">
                  <Clock size={12} />
                  Created: {currentContent.created_at ? format(new Date(currentContent.created_at), 'yyyy-MM-dd HH:mm') : '-'}
                </div>
                {currentContent.task_description && (
                  <div className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    {currentContent.task_description}
                  </div>
               )}
            </div>

            {/* Stats & Actions */}
            <div className="flex items-center gap-4">
              {stateStats && (
                <div className="flex items-center gap-3 text-xs font-mono bg-slate-900/50 px-3 py-1.5 rounded border border-slate-800">
                  <span title="Incoming edges (excluding versioning)" className={stateStats.in_count > 0 ? "text-amber-400" : "text-slate-500"}>
                    In: {stateStats.in_count}
                  </span>
                  <span className="text-slate-700">|</span>
                  <span title="Outgoing edges (excluding versioning)" className={stateStats.out_count > 0 ? "text-amber-400" : "text-slate-500"}>
                    Out: {stateStats.out_count}
                  </span>
                </div>
              )}
              
              <button 
                onClick={handleDeleteState}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/20 text-red-300 text-xs rounded border border-red-900/30 hover:bg-red-900/40 hover:border-red-500/50 transition-colors"
                title="Delete this version"
              >
                <Trash2 size={12} />
                Delete State
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-slate-900/30 rounded-lg p-6 border border-slate-800">
           <div className="flex items-center justify-between mb-4">
             <h2 className="text-sm font-bold text-slate-400 uppercase flex items-center gap-2">
               <FileText size={16} />
               Profile Content
             </h2>
             {!isEditing && (
               <button
                 onClick={startEdit}
                 className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-900/30 text-indigo-300 text-xs rounded border border-indigo-800/50 hover:bg-indigo-900/50 hover:border-indigo-600 transition-colors"
               >
                 <Pencil size={12} />
                 Edit
               </button>
             )}
           </div>
           
           {isEditing ? (
             <div className="space-y-4">
               {/* Name input */}
               <div>
                 <label className="text-xs text-slate-500 uppercase font-bold mb-1 block">Name</label>
                 <input
                   type="text"
                   value={editName}
                   onChange={(e) => setEditName(e.target.value)}
                   className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
                   placeholder="Entity name"
                 />
               </div>
               
               {/* Content textarea */}
               <div>
                 <label className="text-xs text-slate-500 uppercase font-bold mb-1 block">Content</label>
                 <textarea
                   value={editContent}
                   onChange={(e) => setEditContent(e.target.value)}
                   className="w-full min-h-[500px] bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm font-mono text-slate-200 resize-y focus:border-indigo-500 focus:outline-none"
                   placeholder="Entity content..."
                 />
               </div>
               
               {/* Action buttons */}
               <div className="flex items-center gap-2 pt-2">
                 <button
                   onClick={saveEdit}
                   disabled={saving}
                   className="flex items-center gap-1.5 px-4 py-2 bg-emerald-900/50 text-emerald-200 text-sm rounded border border-emerald-800 hover:bg-emerald-800/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   <Save size={14} />
                   {saving ? 'Saving...' : 'Save'}
                 </button>
                 <button
                   onClick={cancelEdit}
                   disabled={saving}
                   className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-slate-300 text-sm rounded border border-slate-700 hover:bg-slate-700 transition-colors disabled:opacity-50"
                 >
                   <X size={14} />
                   Cancel
                 </button>
               </div>
             </div>
           ) : (
             <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap font-mono text-slate-300">
               {currentContent.content}
             </div>
           )}
        </div>

        {/* Outbound Relationships */}
        <div>
           <div className="flex items-center justify-between mb-4">
             <h2 className="text-sm font-bold text-slate-400 uppercase flex items-center gap-2">
               <ArrowRight size={16} />
               All Outbound Relationships
             </h2>
             <span className="text-xs text-slate-600">
               Includes lazy-updated edges from older versions
             </span>
           </div>
           
           {outboundEdges.length === 0 ? (
             <div className="text-slate-600 italic">No outbound relationships recorded.</div>
           ) : (
             <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
               {outboundEdges.map(edge => (
                 <Link 
                    key={edge.target_entity_id}
                    to={`/memory/relation/${entityId}/${edge.target_entity_id}`}
                    className="block bg-slate-900/50 border border-slate-800 rounded-lg p-4 hover:border-emerald-500/50 hover:bg-emerald-900/10 transition-colors group"
                 >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-emerald-400 group-hover:text-emerald-300">{edge.relation}</span>
                      <ArrowRight size={14} className="text-slate-600 group-hover:text-emerald-500" />
                    </div>
                    <div className="text-sm text-slate-300">
                      Target: <span className="font-semibold text-slate-200">{edge.target_name}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 font-mono flex items-center justify-between">
                      <span>{edge.target_entity_id}</span>
                      <span 
                        className={edge.viewer_version === currentContent.version ? "text-slate-600" : "text-amber-500/70"}
                        title={`Edge attached to version ${edge.viewer_version}`}
                      >
                        v{edge.viewer_version}
                      </span>
                    </div>
                 </Link>
               ))}
             </div>
           )}
        </div>

        {/* Children (Sub-entities) */}
        <div>
           <div className="flex items-center justify-between mb-4">
             <h2 className="text-sm font-bold text-slate-400 uppercase flex items-center gap-2">
               <FolderTree size={16} />
               Children (Sub-entities)
             </h2>
             <div className="flex items-center gap-2">
               <span className="text-xs text-slate-600">
                 Entities that belong to this node
               </span>
               <button
                 onClick={() => setShowAddChild(!showAddChild)}
                 className="flex items-center gap-1 px-2 py-1 bg-violet-900/30 text-violet-300 text-xs rounded border border-violet-800/50 hover:bg-violet-900/50 hover:border-violet-600 transition-colors"
               >
                 <Plus size={12} />
                 Add
               </button>
             </div>
           </div>
           
           {/* Add Child Form */}
           {showAddChild && (
             <div className="mb-4 p-4 bg-slate-900/50 border border-violet-800/30 rounded-lg">
               <div className="flex items-center gap-2">
                 <input
                   type="text"
                   value={newChildId}
                   onChange={(e) => setNewChildId(e.target.value)}
                   placeholder="Enter child entity_id (e.g., event_xxx)"
                   className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:border-violet-500 focus:outline-none"
                   onKeyDown={(e) => e.key === 'Enter' && handleAddChild()}
                 />
                 <button
                   onClick={handleAddChild}
                   disabled={addingChild || !newChildId.trim()}
                   className="px-4 py-2 bg-violet-900/50 text-violet-200 text-sm rounded border border-violet-800 hover:bg-violet-800/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   {addingChild ? 'Adding...' : 'Link'}
                 </button>
                 <button
                   onClick={() => { setShowAddChild(false); setNewChildId(''); }}
                   className="px-3 py-2 bg-slate-800 text-slate-400 text-sm rounded border border-slate-700 hover:bg-slate-700 transition-colors"
                 >
                   <X size={14} />
                 </button>
               </div>
               <p className="text-xs text-slate-500 mt-2">
                 This will create a BELONGS_TO relationship from the child to this entity.
               </p>
             </div>
           )}
           
           {children.length === 0 ? (
             <div className="text-slate-600 italic">No children attached to this entity.</div>
           ) : (
             <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
               {children.map(child => (
                 <div 
                    key={child.entity_id}
                    className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 hover:border-violet-500/50 hover:bg-violet-900/10 transition-colors group"
                 >
                    <div className="flex items-center justify-between mb-2">
                      <Link 
                        to={`/memory/entity/${child.entity_id}`}
                        className="font-bold text-violet-400 group-hover:text-violet-300 hover:underline"
                      >
                        {child.name}
                      </Link>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-400 rounded">{child.node_type}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleUnlinkChild(child.entity_id, child.name); }}
                          className="p-1 text-slate-600 hover:text-red-400 transition-colors"
                          title="Unlink from this parent"
                        >
                          <Unlink size={12} />
                        </button>
                      </div>
                    </div>
                    <Link to={`/memory/entity/${child.entity_id}`}>
                      <div className="text-xs text-slate-400 line-clamp-2">
                        {child.content_snippet || 'No content'}
                      </div>
                      <div className="text-xs text-slate-500 mt-2 font-mono flex items-center justify-between">
                        <span>{child.entity_id}</span>
                        <span className="text-slate-600">v{child.version}</span>
                      </div>
                    </Link>
                 </div>
               ))}
             </div>
           )}
        </div>

      </div>
    </div>
  );
}
