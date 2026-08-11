import Image from 'next/image';
import { cn } from '@/lib/utils';

const logoVariants = {
  dark: {
    src: '/business-ceo/business-ceo-ai-dark-header.png',
    width: 1492,
    height: 172,
  },
  light: {
    src: '/business-ceo/business-ceo-ai-light-header.png',
    width: 1969,
    height: 220,
  },
} as const;

export default function BusinessCeoLogo({
  className,
  decorative = false,
  priority = false,
  tone = 'dark',
}: {
  className?: string;
  decorative?: boolean;
  priority?: boolean;
  tone?: keyof typeof logoVariants;
}) {
  const logo = logoVariants[tone];

  return (
    <Image
      alt={decorative ? '' : 'Business CEO AI'}
      className={cn('h-auto object-contain', className)}
      height={logo.height}
      priority={priority}
      src={logo.src}
      width={logo.width}
    />
  );
}
