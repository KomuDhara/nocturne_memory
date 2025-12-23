import React from 'react';
import { format } from 'date-fns';
import { AlertCircle, CheckCircle2, Clock, FileText, GitCommit, Trash2, Undo2 } from 'lucide-react';
import clsx from 'clsx';

const SnapshotList = ({ snapshots, selectedId, onSelect }) => {
  if (!snapshots || snapshots.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500">
        <CheckCircle2 className="w-12 h-12 mx-auto mb-2 opacity-20" />
        <p>No pending reviews.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-800">
      {snapshots.map((snap) => (
        <div 
          key={snap.resource_id}
          onClick={() => onSelect(snap)}
          className={clsx(
            "p-4 cursor-pointer transition-colors hover:bg-slate-800/50 group",
            selectedId === snap.resource_id ? "bg-slate-800 border-l-2 border-indigo-500" : "border-l-2 border-transparent"
          )}
        >
          <div className="flex items-start justify-between mb-1">
            <span className={clsx(
              "text-xs font-bold px-1.5 py-0.5 rounded uppercase tracking-wide",
              snap.operation_type === 'create' ? "bg-emerald-900/50 text-emerald-400" : "bg-amber-900/50 text-amber-400"
            )}>
              {snap.operation_type || 'modify'}
            </span>
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Clock size={12} />
              {format(new Date(snap.snapshot_time), 'HH:mm:ss')}
            </span>
          </div>
          
          <h3 className="text-sm font-medium text-slate-200 truncate mb-1" title={snap.resource_id}>
            {snap.resource_id}
          </h3>
          
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="bg-slate-800 px-1.5 rounded text-slate-400 border border-slate-700">
              {snap.resource_type}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SnapshotList;
