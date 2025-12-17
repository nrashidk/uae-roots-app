import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LoadingSpinner({ className, size = 'default', text }) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    default: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16'
  };

  return (
    <div className={cn('flex flex-col items-center justify-center gap-2', className)}>
      <Loader2 className={cn('animate-spin text-purple-600', sizeClasses[size])} />
      {text && <p className="text-sm text-gray-600">{text}</p>}
    </div>
  );
}

export function LoadingOverlay({ text = 'جاري التحميل...' }) {
  return (
    <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
      <LoadingSpinner size="lg" text={text} />
    </div>
  );
}

export function LoadingSkeleton({ className, variant = 'default' }) {
  const variants = {
    default: 'h-4 w-full',
    title: 'h-6 w-3/4',
    avatar: 'h-12 w-12 rounded-full',
    card: 'h-32 w-full rounded-lg',
    button: 'h-10 w-24 rounded-md'
  };

  return (
    <div
      className={cn(
        'animate-pulse bg-gray-200 rounded',
        variants[variant],
        className
      )}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-lg p-4 shadow space-y-3">
      <LoadingSkeleton variant="title" />
      <LoadingSkeleton />
      <LoadingSkeleton className="w-2/3" />
    </div>
  );
}

export function PersonCardSkeleton() {
  return (
    <div className="bg-white rounded-lg p-4 shadow flex items-center gap-3">
      <LoadingSkeleton variant="avatar" />
      <div className="flex-1 space-y-2">
        <LoadingSkeleton variant="title" />
        <LoadingSkeleton className="w-1/2" />
      </div>
    </div>
  );
}
