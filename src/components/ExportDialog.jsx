import { useState } from 'react';
import { Download, FileText, Table, Code, FileJson } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const exportFormats = [
  {
    id: 'html',
    name: 'HTML',
    description: 'صفحة ويب قابلة للعرض',
    icon: Code,
    color: 'text-orange-600 bg-orange-100'
  },
  {
    id: 'gedcom',
    name: 'GEDCOM',
    description: 'معيار برامج الأنساب',
    icon: FileText,
    color: 'text-green-600 bg-green-100'
  },
  {
    id: 'csv',
    name: 'CSV',
    description: 'جدول بيانات (Excel)',
    icon: Table,
    color: 'text-blue-600 bg-blue-100'
  },
  {
    id: 'text',
    name: 'نص عادي',
    description: 'ملف نصي بسيط',
    icon: FileText,
    color: 'text-gray-600 bg-gray-100'
  },
  {
    id: 'json',
    name: 'JSON',
    description: 'بيانات خام للمطورين',
    icon: FileJson,
    color: 'text-purple-600 bg-purple-100'
  }
];

export function ExportDialog({ treeId, treeName, trigger }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(null);

  const handleExport = async (format) => {
    if (!treeId) return;
    
    setIsExporting(format);
    try {
      if (format === 'json') {
        const data = await api.export.tree(treeId, 'json');
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${treeName || 'family-tree'}.json`;
        link.click();
        URL.revokeObjectURL(link.href);
      } else {
        await api.export.tree(treeId, format);
      }
      setIsOpen(false);
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            تصدير
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">تصدير شجرة العائلة</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-3 py-4">
          {exportFormats.map((format) => {
            const Icon = format.icon;
            const isLoading = isExporting === format.id;
            
            return (
              <button
                key={format.id}
                onClick={() => handleExport(format.id)}
                disabled={isExporting}
                className="flex items-center gap-4 p-4 rounded-lg border hover:bg-gray-50 transition-colors text-right disabled:opacity-50"
              >
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${format.color}`}>
                  {isLoading ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{format.name}</div>
                  <div className="text-sm text-gray-500">{format.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
