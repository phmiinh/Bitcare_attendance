/** @type {import('next').NextConfig} */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const nextConfig = {
  // Enable standalone output for smaller Docker images
  output: 'standalone',
  async rewrites() {
    // In Kubernetes, backend service name is 'api' in namespace 'bitcare-attendance'
    // Use environment variable for flexibility, fallback to service name in cluster
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://api:80'
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ]
  },
  // Note: we run dev with `next dev --webpack` (see package.json) to avoid Turbopack issues.
  // Keeping this here is harmless, but webpack config below is what fixes the current issue.
  turbopack: {
    root: __dirname,
  },

  webpack: (config) => {
    config.resolve = config.resolve || {}
    // Prevent webpack from resolving to different physical paths for the same folder.
    config.resolve.symlinks = false

    config.resolve.plugins = config.resolve.plugins || []
    config.resolve.plugins.push({
      apply(resolver) {
        resolver.hooks.resolve.tapAsync('CanonicalizeRealPath', (req, ctx, cb) => {
          try {
            if (req.path) {
              // Canonicalize to the OS real path (helps remove casing inconsistencies on Windows).
              req.path = fs.realpathSync.native(req.path)
            }
          } catch {
            // ignore
          }
          cb()
        })
      },
    })

    // Silence noisy Webpack warnings about modules that only differ in casing.
    // Trên Windows, path hoa/thường lẫn lộn là bình thường và không ảnh hưởng tới logic app,
    // nên ta cho Webpack bỏ qua để console đỡ bị spam.
    config.ignoreWarnings = config.ignoreWarnings || []
    config.ignoreWarnings.push({
      message: /multiple modules with names that only differ in casing/i,
    })

    return config
  },

  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
