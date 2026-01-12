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
  // Get backend API URL from environment variable
  // - Local dev: Set API_URL=http://localhost:8080 in .env.local
  // - Kubernetes: Auto-resolve pod IP từ headless service
  // - Fallback: Auto-detect environment and use appropriate default
  const apiUrl = process.env.API_URL || await getDefaultApiUrl()
  const defaultApiUrl = await getDefaultApiUrl() // Store for error logging
  // Fix: Kiểm tra pathSegments trước khi gọi join()
  const path = (pathSegments && pathSegments.length > 0) ? pathSegments.join('/') : ''
  const url = new URL(request.url)
  
  // Build backend URL
  const backendBase = apiUrl.startsWith('http') ? apiUrl : `http://${apiUrl}`
  const backendUrl = `${backendBase}/api/v1/${path}${url.search}`
  
  console.log(`[API Proxy] ${method} ${path} -> ${backendUrl}`)
  
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
    // Log chi tiết lỗi để debug
    const isLocalDev = !process.env.KUBERNETES_SERVICE_HOST
    const errorDetails: any = {
      backendUrl,
      method,
      path,
      apiUrlEnv: process.env.API_URL,
      defaultApiUrl: defaultApiUrl,
      environment: isLocalDev ? 'local' : 'kubernetes',
      errorName: error?.name,
      errorMessage: error?.message,
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
    
    // Handle connection refused errors
    if (error?.code === 'ECONNREFUSED' || error?.cause?.code === 'ECONNREFUSED') {
      const connError = error.cause || error
      const suggestion = isLocalDev
        ? 'Local dev: Ensure backend is running on localhost:8080'
        : 'K8s: Check if backend pods are running and service endpoints are configured'
      
      console.error('[API Proxy] Connection refused:', {
        ...errorDetails,
        resolvedIP: connError.address,
        port: connError.port,
        suggestion
      })
      
      return NextResponse.json(
        { 
          error: { 
            code: 'backend_unavailable', 
            message: 'Backend service is not available.',
            details: `Cannot connect to ${connError.address || apiUrl}:${connError.port || 8080}`,
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
