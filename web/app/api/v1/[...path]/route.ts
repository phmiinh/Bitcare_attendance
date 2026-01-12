import { NextRequest, NextResponse } from 'next/server'

// Proxy API requests to backend service
// This route runs on Node.js runtime (not Edge), so it can connect to internal K8s services
// Fix: Next.js 16 params có thể là Promise, cần await
export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> | { path: string[] } }) {
  const resolvedParams = await Promise.resolve(params)
  return proxyRequest(request, resolvedParams.path || [], 'GET')
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> | { path: string[] } }) {
  const resolvedParams = await Promise.resolve(params)
  return proxyRequest(request, resolvedParams.path || [], 'POST')
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ path: string[] }> | { path: string[] } }) {
  const resolvedParams = await Promise.resolve(params)
  return proxyRequest(request, resolvedParams.path || [], 'PUT')
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ path: string[] }> | { path: string[] } }) {
  const resolvedParams = await Promise.resolve(params)
  return proxyRequest(request, resolvedParams.path || [], 'PATCH')
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path: string[] }> | { path: string[] } }) {
  const resolvedParams = await Promise.resolve(params)
  return proxyRequest(request, resolvedParams.path || [], 'DELETE')
}

// Cache pod IP để tránh resolve nhiều lần
let cachedPodIP: string | null = null
let podIPResolveTime: number = 0
const POD_IP_CACHE_TTL = 60000 // Cache 1 phút

// Invalidate cache khi connection failed
function invalidatePodIPCache() {
  cachedPodIP = null
  podIPResolveTime = 0
  console.log('[API Proxy] Invalidated pod IP cache due to connection failure')
}

// Helper function to resolve pod IP từ headless service
// Với headless service, DNS sẽ tự động resolve thành pod IP khi query
async function resolvePodIPFromDNS(serviceName: string, namespace: string): Promise<string | null> {
  try {
    // Sử dụng Node.js dns module để resolve DNS
    const dns = require('dns')
    const { promisify } = require('util')
    const resolve4 = promisify(dns.resolve4)
    
    const fqdn = `${serviceName}.${namespace}.svc.cluster.local`
    const addresses = await resolve4(fqdn)
    
    // Lấy pod IP đầu tiên
    if (addresses && addresses.length > 0) {
      return addresses[0]
    }
    return null
  } catch (error: any) {
    console.warn(`[API Proxy] DNS resolve failed: ${error?.message}`)
    return null
  }
}

// Helper function to get default API URL based on environment
async function getDefaultApiUrl(): Promise<string> {
  // Check if running in Kubernetes (has KUBERNETES_SERVICE_HOST)
  if (process.env.KUBERNETES_SERVICE_HOST) {
    const namespace = process.env.KUBERNETES_NAMESPACE || 'bitcare-attendance'
    
    // Kiểm tra cache
    const now = Date.now()
    if (cachedPodIP && (now - podIPResolveTime) < POD_IP_CACHE_TTL) {
      return `http://${cachedPodIP}:8080`
    }
    
    // Resolve pod IP từ headless service DNS
    const podIP = await resolvePodIPFromDNS('api', namespace)
    if (podIP) {
      cachedPodIP = podIP
      podIPResolveTime = now
      console.log(`[API Proxy] Resolved backend pod IP: ${podIP}`)
      return `http://${podIP}:8080` // Dùng pod IP trực tiếp
    }
    
    // Fallback: dùng service name (headless service sẽ resolve thành pod IP)
    console.warn(`[API Proxy] Using service name as fallback`)
    return `http://api.${namespace}.svc.cluster.local:8080`
  }
  // Local development - use localhost
  return 'http://localhost:8080'
}

async function proxyRequest(
  request: NextRequest,
  pathSegments: string[] | undefined,
  method: string
) {
  // Fix: Kiểm tra pathSegments trước khi gọi join()
  const path = (pathSegments && pathSegments.length > 0) ? pathSegments.join('/') : ''
  const url = new URL(request.url)
  
  // Retry logic với cache invalidation
  const maxRetries = 2
  let lastError: any = null
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Invalidate cache nếu đây là retry sau connection error
    if (attempt > 0 && lastError?.code === 'ECONNREFUSED') {
      invalidatePodIPCache()
      console.log(`[API Proxy] Retry attempt ${attempt}/${maxRetries} - invalidated cache and resolving new pod IP`)
    }
    
    // Get backend API URL (có thể resolve lại pod IP mới sau khi invalidate cache)
    const apiUrl = process.env.API_URL || await getDefaultApiUrl()
    const defaultApiUrl = await getDefaultApiUrl() // Store for error logging
    
    // Build backend URL
    const backendBase = apiUrl.startsWith('http') ? apiUrl : `http://${apiUrl}`
    const backendUrl = `${backendBase}/api/v1/${path}${url.search}`
    
    if (attempt === 0) {
      console.log(`[API Proxy] ${method} ${path} -> ${backendUrl}`)
    } else {
      console.log(`[API Proxy] Retry ${attempt}/${maxRetries} ${method} ${path} -> ${backendUrl}`)
    }
    
    try {
      // Get request body if present
      let body: string | undefined
      if (method !== 'GET' && method !== 'HEAD' && method !== 'DELETE') {
        try {
          body = await request.text()
        } catch {
          // No body or already consumed
        }
      }
      
      // Forward headers (exclude host and connection-specific headers)
      const headers: Record<string, string> = {}
      request.headers.forEach((value, key) => {
        const lowerKey = key.toLowerCase()
        // Skip headers that shouldn't be forwarded
        if (
          lowerKey !== 'host' &&
          lowerKey !== 'connection' &&
          lowerKey !== 'keep-alive' &&
          lowerKey !== 'upgrade' &&
          lowerKey !== 'te' &&
          lowerKey !== 'trailer' &&
          lowerKey !== 'transfer-encoding'
        ) {
          headers[key] = value
        }
      })
      
      // Ensure cookies are forwarded
      const cookieHeader = request.headers.get('cookie')
      if (cookieHeader) {
        headers['cookie'] = cookieHeader
      }
      
      // Forward the request to backend
      // Fix: Thêm timeout để tránh query bị treo
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 giây timeout
      
      let response: Response
      try {
        response = await fetch(backendUrl, {
          method,
          headers,
          body: body || undefined,
          redirect: 'manual',
          signal: controller.signal,
        })
      } catch (error: any) {
        clearTimeout(timeoutId)
        if (error.name === 'AbortError') {
          console.error('[API Proxy] Request timeout after 30s')
          return NextResponse.json(
            { error: { code: 'timeout', message: 'Backend request timeout' } },
            { status: 504 }
          )
        }
        throw error
      } finally {
        clearTimeout(timeoutId)
      }
      
      // Get response body
      const responseBody = await response.text()
      
      // Create response with same status and headers
      const nextResponse = new NextResponse(responseBody, {
        status: response.status,
        statusText: response.statusText,
      })
      
      // Copy response headers (especially cookies for authentication)
      response.headers.forEach((value, key) => {
        const lowerKey = key.toLowerCase()
        // Skip headers that Next.js manages
        if (
          lowerKey !== 'content-encoding' &&
          lowerKey !== 'transfer-encoding' &&
          lowerKey !== 'connection' &&
          lowerKey !== 'keep-alive'
        ) {
          nextResponse.headers.set(key, value)
        }
      })
      
      // Ensure Set-Cookie headers are forwarded (critical for authentication)
      const setCookieHeaders = response.headers.getSetCookie()
      setCookieHeaders.forEach((cookie) => {
        nextResponse.headers.append('Set-Cookie', cookie)
      })
      
      return nextResponse
    } catch (error: any) {
      lastError = error
      
      // Connection refused - retry với pod IP mới nếu còn attempt
      if ((error?.code === 'ECONNREFUSED' || error?.cause?.code === 'ECONNREFUSED') && attempt < maxRetries) {
        const connError = error.cause || error
        console.warn(`[API Proxy] Connection refused to ${connError.address}:${connError.port}, will retry with new pod IP...`)
        
        // Wait một chút trước khi retry
        await new Promise(resolve => setTimeout(resolve, 100 * attempt))
        continue // Retry với pod IP mới
      }
      
      // Nếu hết retry hoặc không phải connection refused, break để xử lý error ở ngoài
      break
    }
  }
  
  // Nếu đến đây nghĩa là đã hết retry nhưng vẫn fail
  // Xử lý error như bình thường
  if (lastError) {
    const error = lastError
    // Log chi tiết lỗi để debug
    const isLocalDev = !process.env.KUBERNETES_SERVICE_HOST
    const errorDetails: any = {
      backendUrl: lastError?.cause?.address || 'unknown',
      method,
      path,
      apiUrlEnv: process.env.API_URL,
      environment: isLocalDev ? 'local' : 'kubernetes',
      errorName: error?.name,
      errorMessage: error?.message,
      retries: maxRetries,
    }
    
    // Thêm thông tin connection/DNS error nếu có
    if (error?.code) errorDetails.errorCode = error.code
    if (error?.cause) {
      errorDetails.cause = {
        code: error.cause.code,
        address: error.cause.address,
        port: error.cause.port,
        syscall: error.cause.syscall,
        hostname: error.cause.hostname,
      }
    }
    
    // Handle DNS resolution errors với suggestion
    if (error?.code === 'ENOTFOUND' || error?.cause?.code === 'ENOTFOUND') {
      const dnsError = error.cause || error
      const suggestion = isLocalDev
        ? 'Local dev: Create web/.env.local with API_URL=http://localhost:8080'
        : 'K8s DNS issue: Try using FQDN: api.bitcare-attendance.svc.cluster.local:8080 or check CoreDNS'
      
      console.error('[API Proxy] DNS resolution failed:', {
        ...errorDetails,
        hostname: dnsError.hostname || 'api',
        suggestion
      })
      
      return NextResponse.json(
        { 
          error: { 
            code: 'dns_resolution_failed', 
            message: `Cannot resolve hostname: ${dnsError.hostname || 'api'}`,
            details: 'DNS lookup failed. Check API_URL configuration.',
            suggestion
          } 
        },
        { status: 503 }
      )
    }
    
    // Handle connection refused errors (sau khi đã retry)
    if (error?.code === 'ECONNREFUSED' || error?.cause?.code === 'ECONNREFUSED') {
      const connError = error.cause || error
      const suggestion = isLocalDev
        ? 'Local dev: Ensure backend is running on localhost:8080'
        : 'K8s: Backend pod may have restarted. Check pod status: kubectl get pods -n bitcare-attendance -l app.kubernetes.io/name=bitcare-attendance-api'
      
      console.error('[API Proxy] Connection refused after retries:', {
        ...errorDetails,
        resolvedIP: connError.address,
        port: connError.port,
        suggestion
      })
      
      // Invalidate cache để lần request sau sẽ resolve lại
      invalidatePodIPCache()
      
      return NextResponse.json(
        { 
          error: { 
            code: 'backend_unavailable', 
            message: 'Backend service is not available.',
            details: `Cannot connect to ${connError.address || 'backend'}:${connError.port || 8080} after ${maxRetries} retries. Pod may have restarted.`,
            suggestion
          } 
        },
        { status: 503 }
      )
    }
    
    console.error('[API Proxy] Unexpected error:', errorDetails)
    console.error('[API Proxy] Full error:', error)
    
    return NextResponse.json(
      { 
        error: { 
          code: 'proxy_error', 
          message: 'Failed to proxy request to backend',
          details: error?.message || 'Unknown error occurred'
        } 
      },
      { status: 502 }
    )
  }
}
