
"use client";

import Image from 'next/image';
import { useAuth } from '@/hooks/use-auth';

interface LogoProps {
  size?: 'default' | 'large';
}

const Logo = ({ size = 'default' }: LogoProps) => {
    const { companyProfile } = useAuth();
    const logoUrl = companyProfile?.logoUrl || "https://uploads.onecompiler.io/43rqwtabp/43s3ube24/logo_DezLog_transparente.png";
    const companyName = companyProfile?.razaoSocial || "Dezlog";

    const dimensions = {
      default: { width: 137, height: 42, style: { maxHeight: '32px' } },
      large: { width: 325, height: 91, style: { maxHeight: '91px' } },
    };

    const { width, height, style } = dimensions[size];

    return (
        <img 
            src={logoUrl}
            alt={`Logo ${companyName}`}
            width={width}
            height={height}
            style={{ width: 'auto', height: 'auto', ...style }}
        />
    );
};

export default Logo;
