import { useState, useRef } from 'react';
import { Camera, Upload, X, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export function PhotoUpload({ currentPhoto, onPhotoChange, gender }) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(currentPhoto || null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('يرجى اختيار ملف صورة');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('حجم الصورة يجب أن يكون أقل من 5 ميجابايت');
      return;
    }

    setError(null);
    setIsUploading(true);

    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);

    try {
      const result = await api.upload.photo(file);
      if (result.success) {
        setPreviewUrl(result.photoUrl);
        onPhotoChange?.(result.photoUrl);
      }
    } catch (err) {
      setError('فشل رفع الصورة. حاول مرة أخرى');
      setPreviewUrl(currentPhoto || null);
    } finally {
      setIsUploading(false);
      URL.revokeObjectURL(localPreview);
    }
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    onPhotoChange?.(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const bgColor = gender === 'male' ? 'bg-blue-100' : 'bg-pink-100';
  const iconColor = gender === 'male' ? 'text-blue-400' : 'text-pink-400';

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <div className={`h-24 w-24 rounded-full overflow-hidden ${bgColor} flex items-center justify-center`}>
          {isUploading ? (
            <LoadingSpinner size="default" />
          ) : previewUrl ? (
            <img
              src={previewUrl}
              alt="صورة شخصية"
              className="h-full w-full object-cover"
            />
          ) : (
            <User className={`h-12 w-12 ${iconColor}`} />
          )}
        </div>
        
        {previewUrl && !isUploading && (
          <button
            onClick={handleRemove}
            className="absolute -top-1 -right-1 h-6 w-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="gap-2"
      >
        {previewUrl ? (
          <>
            <Camera className="h-4 w-4" />
            تغيير الصورة
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            رفع صورة
          </>
        )}
      </Button>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
