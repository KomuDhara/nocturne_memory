import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getRelationDetail, deleteDirectEdge, updateDirectEdge } from '../../lib/api';
import { Clock, BookOpen, Link as LinkIcon, ArrowRight, GitCommit, Trash2, Pencil, Save, X } from 'lucide-react';
import { format } from 'date-fns';

export default function RelationDetail() {
  const { viewerId, targetId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editRelation, setEditRelation] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Reset edit mode when switching relations
    setIsEditing(false);
    setEditContent('');
    setEditRelation('');
    loadData();
  }, [viewerId, targetId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await getRelationDetail(viewerId, targetId);
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this relationship? This action cannot be undone.')) return;
    try {
      await deleteDirectEdge(viewerId, targetId);
      navigate(`/memory/entity/${viewerId}`);
    } catch (err) {
      console.error('Failed to delete relationship:', err);
      alert('Failed to delete relationship');
    }
  };

  // Edit handlers
  const startEdit = () => {
    setEditContent(data?.direct?.content || '');
    setEditRelation(data?.direct?.relation || '');
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditContent('');
    setEditRelation('');
  };

  const saveEdit = async () => {
    if (!editContent.trim()) {
      alert('Content cannot be empty');
      return;
    }
    
    setSaving(true);
    try {
      const relationChanged = editRelation !== data?.direct?.relation;
      await updateDirectEdge(
        viewerId,
        targetId,
        editContent,
        relationChanged ? editRelation : null
      );
      setIsEditing(false);
      loadData(); // Reload to show updated content
    } catch (err) {
      alert(`Failed to save: ${err.response?.data?.detail || err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading relationship...</div>;
  if (!data || !data.direct) return <div className="p-8 text-center text-slate-500">Relationship not found</div>;

  const { viewer_state, target_state, direct, relays } = data;

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header - Graph Context */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-800">
           <div className="flex items-center gap-4">
              <Link to={`/memory/entity/${viewerId}`} className="text-right group">
                 <div className="text-xl font-bold text-slate-200 group-hover:text-emerald-400">{viewer_state.name}</div>
                 <div className="text-xs text-slate-500 font-mono">{viewerId}</div>
              </Link>
              
              <div className="flex flex-col items-center px-4">
                 <div className="text-xs text-slate-500 uppercase font-bold mb-1">Views</div>
                 <ArrowRight className="text-emerald-500" />
              </div>

              <Link to={`/memory/entity/${targetId}`} className="group">
                 <div className="text-xl font-bold text-slate-200 group-hover:text-emerald-400">{target_state.name}</div>
                 <div className="text-xs text-slate-500 font-mono">{targetId}</div>
              </Link>
           </div>
           
           <div className="text-right">
              <div className="flex items-center justify-end gap-3 mb-1">
                <button 
                  onClick={handleDelete}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/20 text-red-300 text-xs rounded border border-red-900/30 hover:bg-red-900/40 hover:border-red-500/50 transition-colors"
                  title="Delete Relationship"
                >
                  <Trash2 size={12} />
                  Delete Relationship
                </button>
                <div className="text-2xl font-bold text-emerald-400">{direct.relation}</div>
              </div>
               <div className="text-xs text-slate-500 flex items-center justify-end gap-1">
                  <Clock size={12} />
                  {direct.created_at ? format(new Date(direct.created_at), 'yyyy-MM-dd HH:mm') : '-'}
               </div>
            </div>
         </div>

        {/* Overview (Direct Edge Content) */}
        <div className="bg-slate-900/30 rounded-lg p-6 border border-slate-800">
           <div className="flex items-center justify-between mb-4">
             <h2 className="text-sm font-bold text-slate-400 uppercase flex items-center gap-2">
               <LinkIcon size={16} />
               Relationship Overview
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
               {/* Relation label input */}
               <div>
                 <label className="text-xs text-slate-500 uppercase font-bold mb-1 block">Relation Label</label>
                 <input
                   type="text"
                   value={editRelation}
                   onChange={(e) => setEditRelation(e.target.value)}
                   className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
                   placeholder="e.g. LOVES, RESPECTS, FEARS"
                 />
               </div>
               
               {/* Content textarea */}
               <div>
                 <label className="text-xs text-slate-500 uppercase font-bold mb-1 block">Overview Content</label>
                 <textarea
                   value={editContent}
                   onChange={(e) => setEditContent(e.target.value)}
                   className="w-full min-h-[400px] bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm font-mono text-slate-200 resize-y focus:border-indigo-500 focus:outline-none"
                   placeholder="Describe this relationship..."
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
               {direct.content}
             </div>
           )}
        </div>

        {/* Chapters (Relay Edges) */}
        <div>
           <div className="flex items-center justify-between mb-4">
               <h2 className="text-sm font-bold text-slate-400 uppercase flex items-center gap-2">
                 <BookOpen size={16} />
                 Memory Chapters ({relays.length})
               </h2>
           </div>
           
           {relays.length === 0 ? (
             <div className="text-slate-600 italic">No specific memories recorded yet.</div>
           ) : (
             <div className="space-y-3">
               {relays.map(relay => (
                 <Link 
                    key={relay.edge_id}
                    to={`/memory/chapter/${viewerId}/${targetId}/${encodeURIComponent(relay.state.name || relay.relation)}`}
                    className="block bg-slate-900/50 border border-slate-800 rounded-lg p-4 hover:border-indigo-500/50 hover:bg-indigo-900/10 transition-colors group"
                 >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-indigo-400 group-hover:text-indigo-300 text-lg">
                        {relay.state.name || relay.relation}
                      </span>
                      <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                        <GitCommit size={12} />
                        v{relay.state.version}
                      </span>
                    </div>
                    <div className="text-sm text-slate-400 line-clamp-2 font-mono opacity-80">
                      {relay.state.content}
                    </div>
                 </Link>
               ))}
             </div>
           )}
        </div>

      </div>
    </div>
  );
}
