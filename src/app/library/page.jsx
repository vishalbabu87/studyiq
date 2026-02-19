import { useEffect, useState, useCallback } from "react";
import { Folder, FileText, Eye, X, Trash2, CheckSquare, Square } from "lucide-react";
import { getAllCategories, getFilesByCategory, getEntriesByFile, initDB, deleteCategory, deleteFileAndContent } from "@/utils/db";

const entriesPerPage = 25;


export default function LibraryPage() {
  // Existing state
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [entries, setEntries] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);

  // State for selection feature
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [selectionType, setSelectionType] = useState(null); // 'category' or 'file'

  const refreshData = useCallback(() => {
    initDB().then(() => {
      getAllCategories().then(setCategories);
      if (selectedCategory) {
        getFilesByCategory(selectedCategory).then(setFiles);
      }
    });
  }, [selectedCategory]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    if (selectedCategory) {
      getFilesByCategory(selectedCategory).then(setFiles);
    } else {
      setFiles([]);
    }
    setSelectedFile(null);
    setEntries([]);
  }, [selectedCategory]);

  useEffect(() => {
    if (selectedFile) {
      getEntriesByFile(selectedFile).then((data) => {
        setEntries(data);
        setCurrentPage(1);
      });
    } else {
      setEntries([]);
    }
  }, [selectedFile]);

  const paginatedEntries = entries.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);
  const totalPages = Math.ceil(entries.length / entriesPerPage);

  const startSelection = (type, itemId) => {
    if(isSelectionMode) return; // Don't start a new selection if already in selection mode
    setIsSelectionMode(true);
    setSelectionType(type);
    setSelectedItems(new Set([itemId]));
  };
  
  const toggleSelection = (itemId) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    
    if (newSelection.size === 0) {
      cancelSelection();
    } else {
      setSelectedItems(newSelection);
    }
  };
  
  const cancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedItems(new Set());
    setSelectionType(null);
  };
  
  const handleDelete = async () => {
    if (selectedItems.size === 0) return;

    const confirmation = window.confirm(`Are you sure you want to delete ${selectedItems.size} item(s)? This may be irreversible.`);
    if (!confirmation) return;

    if (selectionType === 'category') {
      await Promise.all(Array.from(selectedItems).map(id => deleteCategory(id)));
    } else if (selectionType === 'file') {
      await Promise.all(Array.from(selectedItems).map(id => deleteFileAndContent(id)));
    }

    refreshData();
    cancelSelection();
  };
  
  const handleSelectAll = () => {
    if (selectionType === 'category') {
        setSelectedItems(new Set(categories.map(c => c.id)));
    } else if (selectionType === 'file') {
        setSelectedItems(new Set(files.map(f => f.id)));
    }
  };

  const SelectionActionBar = () => {
    if (!isSelectionMode) return null;

    return (
        <div className="selection-action-bar fixed bottom-4 right-4 z-[100] p-3 rounded-2xl shadow-2xl flex items-center gap-2">
            <span className="font-semibold text-sm px-2">{selectedItems.size} selected</span>
            <button onClick={handleSelectAll} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-gray-800 dark:text-gray-200"><CheckSquare size={18}/> All</button>
            <button onClick={handleDelete} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors font-medium"><Trash2 size={18} /> Delete</button>
            <button onClick={cancelSelection} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-gray-800 dark:text-gray-200"><X size={18}/></button>
        </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-3 md:px-4 py-4 md:py-8">
      <SelectionActionBar />
        <div className="bg-white dark:bg-gray-900 rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-lg hover-lift border border-gray-200 dark:border-gray-800 mb-4 md:mb-8">
          <h1 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent">
            Your Library
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-6">
          <div className="glass-card p-3 md:p-6 hover-lift relative">
            <div className="flex justify-between items-center mb-2 md:mb-4">
              <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
                <Folder size={20} md:size={24} className="text-purple-600" />
                Categories
              </h2>
              <button
                onClick={() => {
                  setIsSelectionMode(true);
                  setSelectionType('category');
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
              >
                Select
              </button>
            </div>
            <div className="space-y-2">
              {categories.map((cat) => {
                  const isSelected = selectedItems.has(cat.id);

                  return (
                    <div key={cat.id} className="relative rounded-xl">
                        <button
                        onClick={() => {
                            if (isSelectionMode) {
                                if (selectionType !== 'category') return;
                                toggleSelection(cat.id);
                            } else {
                                setSelectedCategory(cat.name);
                            }
                        }}
                        className={`group w-full text-left px-4 py-3 rounded-xl transition-all ring-1 ${
                            isSelectionMode && selectionType === 'category' ? 
                            (isSelected ? 'ring-purple-600 ring-2 bg-purple-100 dark:bg-purple-900/50' : 'ring-gray-300 dark:ring-gray-600 opacity-70') :
                            (selectedCategory === cat.name
                            ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg ring-transparent"
                            : "bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 ring-slate-200/60 dark:ring-white/10")
                        }`}
                        >
                        {cat.name}
                        </button>
                        {isSelectionMode && selectionType === 'category' && (
                           <div className="absolute top-1/2 -translate-y-1/2 right-3 pointer-events-none">
                               {isSelected ? <CheckSquare className="text-purple-600" /> : <Square className="text-gray-400" />}
                           </div>
                        )}
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="glass-card p-3 md:p-6 hover-lift relative">
            <div className="flex justify-between items-center mb-2 md:mb-4">
              <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
                <FileText size={20} md:size={24} className="text-blue-600" />
                Files
              </h2>
              <button
                onClick={() => {
                  setIsSelectionMode(true);
                  setSelectionType('file');
                }}
                className="px-3 md:px-4 py-1.5 md:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Select
              </button>
            </div>
            <div className="space-y-2">
              {files.map((file) => {
                  const isSelected = selectedItems.has(file.id);

                  return (
                    <div key={file.id} className="relative rounded-xl">
                        <button
                        onClick={() => {
                            if (isSelectionMode) {
                                if (selectionType !== 'file') return;
                                toggleSelection(file.id);
                            } else {
                                setSelectedFile(file.id);
                            }
                        }}
                        className={`group w-full text-left px-3 md:px-4 py-2 md:py-3 rounded-xl transition-all ring-1 ${
                            isSelectionMode && selectionType === 'file' ? 
                            (isSelected ? 'ring-blue-600 ring-2 bg-blue-100 dark:bg-blue-900/50' : 'ring-gray-300 dark:ring-gray-600 opacity-70') :
                            (selectedFile === file.id
                            ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg ring-transparent"
                            : "bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 ring-slate-200/60 dark:ring-white/10")
                        }`}
                        >
                        <div className="font-medium truncate text-sm md:text-base">{file.name}</div>
                        <div className="text-xs md:text-sm opacity-70">{file.entryCount} terms</div>
                        </button>
                        {isSelectionMode && selectionType === 'file' && (
                           <div className="absolute top-1/2 -translate-y-1/2 right-2 md:right-3 pointer-events-none">
                               {isSelected ? <CheckSquare className="text-blue-600" size={18}/> : <Square className="text-gray-400" size={18}/>}
                           </div>
                        )}
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="glass-card p-3 md:p-6 hover-lift">
            <h2 className="text-lg md:text-xl font-bold mb-2 md:mb-4 flex items-center gap-2">
              <Eye size={20} md:size={24} className="text-green-600" />
              Terms ({entries.length})
            </h2>
            <div className="space-y-2 md:space-y-3 max-h-64 md:max-h-96 overflow-y-auto">
              {paginatedEntries.map((entry) => (
                <div key={entry.id} className="p-2 md:p-4 bg-gray-50 dark:bg-gray-800 rounded-xl ring-1 ring-slate-200/60 dark:ring-white/10 hover-lift">
                  <div className="font-semibold mb-0.5 md:mb-1 text-sm md:text-base">{entry.term}</div>
                  <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400">{entry.meaning}</div>
                  {entry.wrongCount > 0 && <div className="mt-1 md:mt-2 text-xs text-red-500">Wrong: {entry.wrongCount} times</div>}
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-3 md:mt-4 flex items-center justify-between">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 md:px-4 py-1.5 md:py-2 rounded-xl bg-gray-200 dark:bg-gray-700 disabled:opacity-50 text-sm"
                >
                  Prev
                </button>
                <span className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                  {currentPage}/{totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 md:px-4 py-1.5 md:py-2 rounded-xl bg-gray-200 dark:bg-gray-700 disabled:opacity-50 text-sm"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
    </div>
  );
}
