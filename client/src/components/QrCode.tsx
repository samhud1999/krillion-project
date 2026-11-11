import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export interface QrCodeProps {
  value: string;
  /** rendering resolution in px; display size comes from className (e.g. `w-64`) */
  size?: number;
  className?: string;
}

export function QrCode({ value, size = 512, className = '' }: QrCodeProps) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, {
      margin: 1,
      width: size,
      errorCorrectionLevel: 'M',
      color: { dark: '#0b1f2a', light: '#f7efe0' },
    })
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  return (
    <div className={['aspect-square rounded-3xl bg-sand-100 p-[4%] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]', className].join(' ')}>
      {src ? (
        <img src={src} alt={`QR code to join: ${value}`} className="block size-full rounded-xl" />
      ) : (
        <div className="grid size-full place-items-center text-xs text-ink/60">…</div>
      )}
    </div>
  );
}
