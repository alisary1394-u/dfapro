import React, { useState } from "react";
import { entities } from "@/api/entities";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";

const colorMap = {
  gold: "bg-[#d4a843]",
  emerald: "bg-emerald-500",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500"
};

export default function WatchlistTabs({ collections, activeCollectionId, onSelectCollection, onCollectionsUpdate }) {
  const [showCreateForm, setShowCreateForm] = useState(collections.length === 0);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("gold");
  const [newDesc, setNewDesc] = useState("");
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data) => entities.WatchlistCollection.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlistCollections'] });
      setNewName("");
      setNewColor("gold");
      setShowCreateForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => entities.WatchlistCollection.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlistCollections'] });
    },
  });

  const handleCreate = () => {
    if (newName.trim()) {
      createMutation.mutate({ 
        name: newName, 
        color: newColor,
        description: newDesc,
        is_default: collections.length === 0
      });
      setNewDesc("");
    }
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      {collections.map((col) => (
        <div
          key={col.id}
          className="relative group"
        >
          <button
            onClick={() => onSelectCollection(col.id)}
            className={`
              px-4 py-2 rounded-lg font-semibold text-sm whitespace-nowrap transition-all
              ${activeCollectionId === col.id
                ? `${colorMap[col.color]} text-black`
                : "bg-[#1e293b] text-[#94a3b8] hover:bg-[#2d3a4f]"
              }
            `}
          >
            {col.name}
          </button>

          {/* Delete button on hover */}
          <button
            onClick={() => deleteMutation.mutate(col.id)}
            className="absolute -top-2 -right-2 p-1 bg-red-500/80 hover:bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-3 h-3 text-white" />
          </button>
        </div>
      ))}

      {/* Create New */}
      {!showCreateForm ? (
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 rounded-lg bg-[#d4a843]/20 hover:bg-[#d4a843]/30 text-[#d4a843] font-semibold text-sm flex items-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" />
          قائمة جديدة
        </button>
      ) : (
        <div className="bg-[#151c2c] border border-[#1e293b] rounded-lg p-4 space-y-3 w-full max-w-sm">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="اسم القائمة..."
            className="w-full bg-[#1e293b] text-white text-sm px-3 py-2 rounded outline-none border border-[#2d3a4f] focus:border-[#d4a843]/50"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <input
            type="text"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="وصف القائمة (اختياري)..."
            className="w-full bg-[#1e293b] text-white text-sm px-3 py-2 rounded outline-none border border-[#2d3a4f] focus:border-[#d4a843]/50"
          />
          <select
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="w-full bg-[#1e293b] text-white text-sm rounded px-3 py-2 outline-none border border-[#2d3a4f] focus:border-[#d4a843]/50"
          >
            <option value="gold">🟡 ذهبي</option>
            <option value="emerald">🟢 أخضر</option>
            <option value="blue">🔵 أزرق</option>
            <option value="purple">🟣 بنفسجي</option>
            <option value="pink">🩷 وردي</option>
          </select>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="flex-1 px-3 py-2 bg-[#d4a843] hover:bg-[#e8c76a] disabled:opacity-40 text-black text-sm font-semibold rounded transition-all"
            >
              إنشاء
            </button>
            <button
              onClick={() => {
                setShowCreateForm(false);
                setNewName("");
                setNewDesc("");
              }}
              className="px-3 py-2 bg-[#1e293b] hover:bg-[#2d3a4f] text-white rounded transition-all"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
}