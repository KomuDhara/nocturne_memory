import React from 'react';
import { diffLines } from 'diff';
import clsx from 'clsx';

const DiffViewer = ({ oldText, newText, mode = 'unified' }) => {
  // If one text is missing (creation/deletion), handle gracefully
  const safeOld = oldText || '';
  const safeNew = newText || '';

  const diff = diffLines(safeOld, safeNew);

  return (
    <div className="font-mono text-sm bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
      <div className="flex bg-slate-900 p-2 border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
        <div className="flex-1 text-center">Before (Snapshot)</div>
        <div className="flex-1 text-center">After (Current)</div>
      </div>
      
      <div className="overflow-x-auto">
        {mode === 'unified' ? (
          // Unified View
          <table className="w-full border-collapse">
            <tbody>
              {diff.map((part, index) => {
                const color = part.added ? 'bg-green-900/30 text-green-200' : 
                              part.removed ? 'bg-red-900/30 text-red-200' : 
                              'text-slate-400';
                const prefix = part.added ? '+' : part.removed ? '-' : ' ';
                
                return (
                  <tr key={index} className={color}>
                     <td className="p-1 px-2 whitespace-pre-wrap break-all align-top border-b border-slate-800/50 w-full">
                       {part.value}
                     </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
           // Split View - simplified
           <div className="flex divide-x divide-slate-800">
             <div className="w-1/2 p-2 overflow-x-auto bg-slate-950/50">
               <pre className="whitespace-pre-wrap text-red-200">{safeOld}</pre>
             </div>
             <div className="w-1/2 p-2 overflow-x-auto bg-slate-950">
               <pre className="whitespace-pre-wrap text-green-200">{safeNew}</pre>
             </div>
           </div>
        )}
      </div>
      
      {/* Simple Custom Renderer for better control */}
      <div className="flex divide-x divide-slate-800 text-xs">
        {/* Line numbers and gutter could go here */}
      </div>
    </div>
  );
};

export const SimpleDiff = ({ oldText, newText }) => {
    const diff = diffLines(oldText || '', newText || '');

    return (
        <div className="font-mono text-sm leading-6 bg-slate-950 p-4 rounded-md overflow-x-auto border border-slate-800 whitespace-pre-wrap">
            {diff.map((part, i) => {
                const style = part.added 
                    ? 'bg-emerald-900/30 text-emerald-300 block border-l-2 border-emerald-500 pl-2' 
                    : part.removed 
                    ? 'bg-rose-900/30 text-rose-300 block border-l-2 border-rose-500 pl-2' 
                    : 'text-slate-400';
                
                return (
                    <span key={i} className={style}>
                        {part.value}
                    </span>
                );
            })}
        </div>
    );
};

export default SimpleDiff;
