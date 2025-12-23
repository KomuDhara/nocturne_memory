import React, { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { getCatalog } from '../../lib/api';
import { Book, ChevronRight, Hash, User, MapPin, Users, Calendar, Box, Database, CornerDownRight } from 'lucide-react';
import clsx from 'clsx';

const TYPE_ICONS = {
  character: User,
  location: MapPin,
  faction: Users,
  event: Calendar,
  item: Box,
  default: Hash
};

const NodeIcon = ({ type, className }) => {
  const Icon = TYPE_ICONS[type] || TYPE_ICONS.default;
  return <Icon className={className} />;
};

export default function MemoryCatalog() {
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadCatalog();
  }, []);

  const loadCatalog = async () => {
    try {
      const data = await getCatalog();
      setCatalog(data);
    } catch (err) {
      setError("Failed to load catalog");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Group by type
  const grouped = catalog.reduce((acc, item) => {
    const type = item.node_type || 'other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(item);
    return acc;
  }, {});

  return (
    <div className="flex h-full bg-slate-950 text-slate-200 font-sans">
      {/* Sidebar */}
      <div className="w-80 flex-shrink-0 border-r border-slate-800 flex flex-col bg-slate-900/50">
        <div className="p-4 border-b border-slate-800 bg-slate-900">
          <h1 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
            <Database className="w-5 h-5" />
            Memory Explorer
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
            {loading && <div className="p-4 text-slate-500 text-center">Loading...</div>}
            {error && <div className="p-4 text-rose-500 text-center">{error}</div>}
            
            {!loading && Object.entries(grouped).map(([type, items]) => (
                <div key={type} className="mb-6">
                    <h3 className="px-2 text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                        <NodeIcon type={type} className="w-3 h-3" />
                        {type}s
                    </h3>
                    <div className="space-y-0.5">
                        {items.map(item => (
                            <div key={item.entity_id}>
                                <NavLink
                                    to={`/memory/entity/${item.entity_id}`}
                                    className={({ isActive }) => clsx(
                                        "block px-2 py-1.5 rounded text-sm transition-colors flex items-center justify-between group",
                                        isActive ? "bg-emerald-900/30 text-emerald-200" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                                    )}
                                >
                                    <span className="truncate">{item.name}</span>
                                </NavLink>
                                
                                {/* Direct Edges (Sub-menu) */}
                                {item.edges.length > 0 && (
                                    <div className="ml-2 pl-2 border-l border-slate-800 my-1 space-y-0.5">
                                        {item.edges.map(edge => (
                                            <NavLink
                                                key={edge.edge_id}
                                                to={`/memory/relation/${item.entity_id}/${edge.target_entity_id}`}
                                                className={({ isActive }) => clsx(
                                                    "flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors",
                                                    isActive ? "text-emerald-300 bg-emerald-900/20" : "text-slate-500 hover:text-slate-300"
                                                )}
                                            >
                                                <CornerDownRight size={10} />
                                                <span className="truncate opacity-75">{edge.relation}</span>
                                                <span className="opacity-50 text-[10px]">→ {edge.target_name}</span>
                                            </NavLink>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
