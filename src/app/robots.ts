import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/auth/reset-password',
          '/cdn-cgi/',
        ],
      },
    ],
    sitemap: 'https://snapflix.indevs.in/sitemap.xml',
  };
}

