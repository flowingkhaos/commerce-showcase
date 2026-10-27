import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const nextConfig: NextConfig = {
  // A self-contained server (.next/standalone) keeps the image under the registry's free 0.5 GB.
  output: 'standalone',
  outputFileTracingRoot: path.resolve(dirname),
  // Admin-only app: no frontend, so `/` goes to the admin.
  async redirects() {
    return [{ source: '/', destination: '/admin', permanent: false }]
  },
  // The CMS is never indexed (architecture conv. 17).
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'x-robots-tag', value: 'noindex, nofollow' }] }]
  },
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
