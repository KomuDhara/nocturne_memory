import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getChapter, deleteRelayEdge, updateChapter, getEntityInfo, getState } from '../../lib/api';
import { Clock, BookOpen, ArrowLeft, GitCommit, Trash2, Pencil, Save, X, Layers } from 'lucide-react';
import { format } from 'date-fns';

export default function ChapterDetail() {
  const { viewerId, targetId, chapterName } = useParams();
  const navigate = useNavigate();

  const [resolvedStateId, setResolvedStateId] = useState(null);
  const [resolvedEdgeId, setResolvedEdgeId] = useState(null);
  const [versions, setVersions] = useState([]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Check if we have enough info to edit
  const canEdit = viewerId && targetId && chapterName;

  // Track if component is mounted to prevent state updates on unmount
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Reset edit mode when switching chapters
    setIsEditing(false);
    setEditContent('');
    loadData();
  }, [viewerId, targetId, chapterName]);

  const loadData = async () => {
    setLoading(true);
    setVersions([]);
    try {
      if (!viewerId || !targetId || !chapterName) {
        if (mountedRef.current) setData(null);
        return;
      }

      const response = await getChapter(viewerId, targetId, chapterName);
      if (!mountedRef.current) return;

      if (!response || !response.state) {
        setData(null);
        return;
      }

      setResolvedStateId(response.state.state_id);
      setResolvedEdgeId(response.edge_id);
      setData(response.state);

      // Fetch versions history
      if (response.state.entity_id) {
        const info = await getEntityInfo(response.state.entity_id);
        if (mountedRef.current) {
          setVersions(info.history || []);
        }
      }

    } catch (err) {
      console.error(err);
      if (mountedRef.current) setData(null);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const loadVersionDetails = async (stateId) => {
    if (!stateId) return;
    setLoading(true);
    try {
      const contentData = await getState(stateId);
      if (mountedRef.current) {
        setData(contentData);
        setResolvedStateId(stateId);
      }
    } catch (err) {
      console.error("Failed to load version details", err);
      alert("Failed to load version details");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this chapter? This action cannot be undone.')) return;
    try {
      if (resolvedEdgeId) {
        await deleteRelayEdge(resolvedEdgeId);
        navigate(`/memory/relation/${viewerId}/${targetId}`);
      } else {
        alert('Cannot delete: Missing edge ID information.');
      }
    } catch (err) {
      console.error('Failed to delete chapter:', err);
      alert('Failed to delete chapter');
    }
  };

  // Edit handlers
  const startEdit = () => {
    setEditContent(data?.content || '');
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditContent('');
  };

  const saveEdit = async () => {
    if (!editContent.trim()) {
      alert('Content cannot be empty');
      return;
    }
    
    if (!canEdit) {
      alert('Missing viewer/target/chapter info for editing');
      return;
    }
    
    setSaving(true);
    try {
      await updateChapter(
        viewerId,
        targetId,
        chapterName,
        editContent
      );
      setIsEditing(false);
      loadData(); // Reload to show updated content (will fetch new version list too)
    } catch (err) {
      alert(`Failed to save: ${err.response?.data?.detail || err.message}`);
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  if (loading && !data) return <div className="p-8 text-center text-slate-500">Loading chapter...</div>;
  if (!data) return <div className="p-8 text-center text-slate-500">Chapter not found</div>;

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Navigation */}
        <button 
           onClick={() => navigate(-1)} 
           className="flex items-center gap-2 text-slate-500 hover:text-slate-300 transition-colors text-sm"
        >
           <ArrowLeft size={16} /> Back
        </button>

        {/* Header */}
        <div className="pb-6 border-b border-slate-800">
           <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-indigo-400 text-sm font-bold uppercase tracking-wider">
                 <BookOpen size={14} />
                 Memory Chapter
              </div>
              
              <div className="flex items-center gap-4">
                {/* Stats */}
                <div className="flex items-center gap-3 text-xs font-mono bg-slate-900/50 px-3 py-1.5 rounded border border-slate-800">
                  <span title="Incoming edges (excluding versioning)" className={(data.in_count || 0) > 0 ? "text-amber-400" : "text-slate-500"}>
                    In: {data.in_count || 0}
                  </span>
                  <span className="text-slate-700">|</span>
                  <span title="Outgoing edges (excluding versioning)" className={(data.out_count || 0) > 0 ? "text-amber-400" : "text-slate-500"}>
                    Out: {data.out_count || 0}
                  </span>
                </div>

                {/* Version Selector */}
                {versions.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Layers size={14} className="text-slate-500" />
                    <select 
                      value={resolvedStateId || ''}
                      onChange={(e) => loadVersionDetails(e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
                    >
                       {versions.map(v => (
                         <option key={v.state_id} value={v.state_id}>
                           v{v.version} ({format(new Date(v.created_at), 'MM-dd HH:mm')})
                         </option>
                       ))}
                     </select>
                  </div>
                )}

                {resolvedEdgeId && (
                  <button 
                    onClick={handleDelete}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/20 text-red-300 text-xs rounded border border-red-900/30 hover:bg-red-900/40 hover:border-red-500/50 transition-colors"
                  >
                   <Trash2 size={12} />
                   Delete Chapter
                 </button>
               )}
             </div>
          </div>
          <h1 className="text-3xl font-bold text-slate-100 mb-4">{data.name}</h1>
          
           <div className="flex items-center gap-4 text-xs text-slate-500 font-mono">
              <div className="flex items-center gap-1">
                <Clock size={12} />
                Created: {data.created_at ? format(new Date(data.created_at), 'yyyy-MM-dd HH:mm') : '-'}
              </div>
              <div className="flex items-center gap-1">
                <GitCommit size={12} />
                ID: {data.state_id}
             </div>
             {data.version && (
                <div className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
                  v{data.version}
                </div>
             )}
          </div>
        </div>

        {/* Content */}
        <div className="bg-slate-900/30 rounded-lg p-8 border border-slate-800">
           {!isEditing && canEdit && (
             <div className="flex justify-end mb-4">
               <button
                 onClick={startEdit}
                 className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-900/30 text-indigo-300 text-xs rounded border border-indigo-800/50 hover:bg-indigo-900/50 hover:border-indigo-600 transition-colors"
               >
                 <Pencil size={12} />
                 Edit
               </button>
             </div>
           )}
           
           {isEditing ? (
             <div className="space-y-4">
               
               {/* Content textarea */}
               <div>
                 <label className="text-xs text-slate-500 uppercase font-bold mb-1 block">Content</label>
                 <textarea
                   value={editContent}
                   onChange={(e) => setEditContent(e.target.value)}
                   className="w-full min-h-[600px] bg-slate-950 border border-slate-700 rounded px-3 py-2 text-base font-serif text-slate-200 resize-y focus:border-indigo-500 focus:outline-none leading-relaxed"
                   placeholder="Chapter content..."
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
             <div className="prose prose-invert max-w-none whitespace-pre-wrap font-serif text-lg leading-relaxed text-slate-300">
               {data.content}
             </div>
           )}
        </div>

      </div>
    </div>
  );
}
