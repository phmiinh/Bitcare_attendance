import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  // Proxy API requests to backend service
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const apiUrl = process.env.API_URL || 'http://api:8080'
    const url = request.nextUrl.clone()
    
    // Build backend URL
    const backendUrl = `${apiUrl}${url.pathname}${url.search}`
    
    // Get request body if present
    let body: ReadableStream | null = null
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      body = request.body
    }
    
    // Forward headers (exclude host)
    const headers = new Headers()
    request.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'host') {
        headers.set(key, value)
      }
    })
    
    try {
      // Forward the request to backend
      const response = await fetch(backendUrl, {
        method: request.method,
        headers,
        body,
      })
      
      // Get response body
      const responseBody = await response.text()
      
      // Create response with same status and headers
      const nextResponse = new NextResponse(responseBody, {
        status: response.status,
        statusText: response.statusText,
      })
      
      // Copy response headers
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() !== 'content-encoding' && key.toLowerCase() !== 'transfer-encoding') {
          nextResponse.headers.set(key, value)
        }
      })
      
      return nextResponse
    } catch (error) {
      console.error('Proxy error:', error)
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
