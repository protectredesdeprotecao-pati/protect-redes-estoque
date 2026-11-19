import React, { useState } from 'react';
import { Package } from 'lucide-react';

interface ProductImageProps {
  src?: string;
  alt: string;
  sizeClass?: string;
  roundedClass?: string;
  hoverZoom?: boolean;
}

export const ProductImage: React.FC<ProductImageProps> = ({
  src,
  alt,
  sizeClass = 'h-10 w-10',
  roundedClass = 'rounded-lg',
  hoverZoom = false,
}) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center border border-[#E2E8F0] bg-[#F1F5F9] text-[#64748B] dark:border-[#1E293B] dark:bg-[#16202A] dark:text-[#94A3B8] ${sizeClass} ${roundedClass}`}
        aria-label={alt}
      >
        <Package className="h-1/2 w-1/2 stroke-[1.75]" />
      </div>
    );
  }

  return (
    <div className={`group relative shrink-0 ${sizeClass}`}>
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`h-full w-full border border-[#E2E8F0] bg-[#F8FAFC] object-cover dark:border-[#1E293B] dark:bg-[#16202A] ${roundedClass}`}
      />
      {hoverZoom && (
        <div className="pointer-events-none fixed z-50 hidden opacity-0 transition-opacity duration-150 group-hover:block group-hover:opacity-100">
          <div className="mt-2 ml-2 overflow-hidden rounded-xl border border-[#E2E8F0] bg-white p-1.5 shadow-2xl dark:border-[#1E293B] dark:bg-[#111820]">
            <img
              src={src}
              alt={alt}
              referrerPolicy="no-referrer"
              className="h-36 w-36 rounded-lg object-cover"
            />
          </div>
        </div>
      )}
    </div>
  );
};
