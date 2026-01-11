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

async function proxyRequest(
  request: NextRequest,
  pathSegments: string[] | undefined,
  method: string
) {
  // Get backend API URL from environment variable
  // In Kubernetes, this is set in deployment.yaml: API_URL=http://api:8080
  const apiUrl = process.env.API_URL || 'http://api:8080'
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
  } catch (error) {
    console.error('[API Proxy] Error:', error)
    console.error('[API Proxy] Backend URL:', backendUrl)
    console.error('[API Proxy] API_URL env:', process.env.API_URL)
    return NextResponse.json(
      { error: { code: 'proxy_error', message: 'Failed to proxy request to backend' } },
      { status: 502 }
    )
  }
}
