import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  // Proxy API requests to backend service
  if (request.nextUrl.pathname.startsWith('/api/')) {
    // Get backend API URL from environment variable
    // In Kubernetes, this is set in deployment.yaml
    const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://api:8080'
    const url = request.nextUrl.clone()
    
    // Build backend URL
    const backendUrl = `${apiUrl}${url.pathname}${url.search}`
    
    console.log(`[Middleware] Proxying ${request.method} ${url.pathname} to ${backendUrl}`)
    
    // Get request body if present
    let body: string | null = null
    if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'DELETE') {
      try {
        body = await request.text()
      } catch {
        // No body or already consumed
      }
    }
    
    // Forward headers (exclude host and connection-specific headers)
    const headers = new Headers()
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
        headers.set(key, value)
      }
    })
    
    // Ensure cookies are forwarded
    const cookieHeader = request.headers.get('cookie')
    if (cookieHeader) {
      headers.set('cookie', cookieHeader)
    }
    
    try {
      // Forward the request to backend
      const response = await fetch(backendUrl, {
        method: request.method,
        headers,
        body: body || undefined,
        // Important: don't follow redirects automatically
        redirect: 'manual',
      })
      
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
      console.error('[Middleware] Proxy error:', error)
      console.error('[Middleware] Backend URL:', backendUrl)
      console.error('[Middleware] API_URL env:', process.env.API_URL)
      return NextResponse.json(
        { error: { code: 'proxy_error', message: 'Failed to proxy request to backend' } },
        { status: 502 }
      )
    }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
