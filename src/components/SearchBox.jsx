import { useState, useCallback } from 'react';
import { Search, X, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export function SearchBox({ treeId, onSelectPerson, className }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleSearch = useCallback(async (searchQuery) => {
    if (!searchQuery.trim() || !treeId) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const data = await api.people.search(treeId, searchQuery);
      setResults(data);
      setIsOpen(true);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [treeId]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    
    const timeoutId = setTimeout(() => {
      handleSearch(value);
    }, 300);
    
    return () => clearTimeout(timeoutId);
  };

  const handleSelectPerson = (person) => {
    onSelectPerson?.(person);
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          value={query}
          onChange={handleInputChange}
          placeholder="ابحث عن فرد في العائلة..."
          className="pr-10 pl-10"
          dir="rtl"
        />
        {query && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute left-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {isOpen && (query || isLoading) && (
        <div className="absolute top-full mt-1 w-full bg-white rounded-lg shadow-lg border z-50 max-h-64 overflow-auto">
          {isLoading ? (
            <div className="p-4 flex justify-center">
              <LoadingSpinner size="sm" />
            </div>
          ) : results.length > 0 ? (
            <ul className="py-1">
              {results.map((person) => (
                <li key={person.id}>
                  <button
                    onClick={() => handleSelectPerson(person)}
                    className="w-full px-4 py-2 text-right hover:bg-purple-50 flex items-center gap-3 transition-colors"
                  >
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                      person.gender === 'male' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
                    }`}>
                      <User className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{person.firstName} {person.lastName || ''}</div>
                      <div className="text-xs text-gray-500">
                        {person.gender === 'male' ? 'ذكر' : 'أنثى'}
                        {person.birthDate && ` • ${person.birthDate}`}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : query && (
            <div className="p-4 text-center text-gray-500">
              لا توجد نتائج لـ "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
