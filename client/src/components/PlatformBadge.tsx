import { PlatformType } from '../types/game';

interface PlatformBadgeProps {
  platform: PlatformType;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const PLATFORM_CONFIG: Record<
  PlatformType,
  { label: string; bgClass: string; icon: string; needsInvert: boolean }
> = {
  steam: {
    label: 'Steam',
    bgClass: 'bg-platform-steam',
    icon: '/icons/steam.png',
    needsInvert: false,
  },
  gamepass: {
    label: 'Game Pass',
    bgClass: 'bg-platform-gamepass',
    icon: '/icons/xbox.png',
    needsInvert: true,
  },
  eaplay: {
    label: 'EA Play',
    bgClass: 'bg-platform-eaplay',
    icon: '/icons/ea.png',
    needsInvert: true,
  },
  ubisoftplus: {
    label: 'Ubisoft+',
    bgClass: 'bg-platform-ubisoftplus',
    icon: '/icons/ubisoft-swirl.svg',
    needsInvert: false,
  },
};

const SIZE_CLASSES = {
  sm: {
    container: 'h-5 px-1.5 text-xs gap-1',
    icon: 'w-3 h-3',
  },
  md: {
    container: 'h-6 px-2 text-sm gap-1.5',
    icon: 'w-4 h-4',
  },
  lg: {
    container: 'h-8 px-3 text-base gap-2',
    icon: 'w-5 h-5',
  },
};

export default function PlatformBadge({
  platform,
  size = 'md',
  showLabel = true,
}: PlatformBadgeProps) {
  const config = PLATFORM_CONFIG[platform];
  const sizeClasses = SIZE_CLASSES[size];

  if (!config) {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center rounded ${config.bgClass} text-white font-medium ${sizeClasses.container}`}
      title={config.label}
    >
      <img
        src={config.icon}
        alt={config.label}
        className={`${sizeClasses.icon} object-contain ${config.needsInvert ? 'brightness-0 invert' : ''}`}
      />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}
