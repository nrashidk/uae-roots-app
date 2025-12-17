import { useState, useEffect } from 'react';
import { History, Undo2, User, Link, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '@/lib/api';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const actionLabels = {
  create: 'إنشاء',
  update: 'تعديل',
  delete: 'حذف'
};

const resourceLabels = {
  person: 'فرد',
  relationship: 'علاقة'
};

export function HistoryPanel({ treeId, onUndo, isOpen, onClose }) {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [undoingId, setUndoingId] = useState(null);

  useEffect(() => {
    if (isOpen && treeId) {
      loadHistory();
    }
  }, [isOpen, treeId]);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const data = await api.history.get(treeId);
      setHistory(data);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUndo = async (historyId) => {
    setUndoingId(historyId);
    try {
      await api.history.undo(historyId);
      onUndo?.();
      loadHistory();
    } catch (error) {
      console.error('Undo failed:', error);
    } finally {
      setUndoingId(null);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'الآن';
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    if (diffDays < 7) return `منذ ${diffDays} يوم`;
    
    return date.toLocaleDateString('ar-AE');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed left-4 top-20 w-80 bg-white rounded-lg shadow-lg border z-40 max-h-[calc(100vh-100px)] flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold flex items-center gap-2">
          <History className="h-5 w-5" />
          سجل التعديلات
        </h3>
        <Button variant="ghost" size="sm" onClick={onClose}>×</Button>
      </div>

      <ScrollArea className="flex-1 p-2">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            لا توجد تعديلات مسجلة
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((entry) => (
              <div
                key={entry.id}
                className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {entry.resourceType === 'person' ? (
                      <User className="h-4 w-4 text-purple-600" />
                    ) : (
                      <Link className="h-4 w-4 text-blue-600" />
                    )}
                    <div>
                      <div className="font-medium text-sm">
                        {actionLabels[entry.action]} {resourceLabels[entry.resourceType]}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(entry.createdAt)}
                      </div>
                    </div>
                  </div>
                  
                  {entry.previousData && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUndo(entry.id)}
                      disabled={undoingId === entry.id}
                      className="h-8 px-2"
                    >
                      {undoingId === entry.id ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <Undo2 className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
