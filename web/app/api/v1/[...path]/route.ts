import { NextRequest, NextResponse } from 'next/server'

// Proxy API requests to backend service
// This route handles all /api/v1/* requests and forwards them to the backend
export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path, 'GET')
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path, 'POST')
}

export async function PUT(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path, 'PUT')
}

export async function PATCH(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path, 'PATCH')
}

export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path, 'DELETE')
}

async function proxyRequest(
  request: NextRequest,
  pathSegments: string[],
  method: string
) {
  // Get backend API URL from environment variable, fallback to service name in cluster
  // In Kubernetes, service name 'api' resolves to http://api:8080 within the same namespace
  const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://api:8080'
  const path = pathSegments.join('/')
  const url = new URL(request.url)
  
  // Build backend URL - ensure we use the correct format
  // If apiUrl doesn't have protocol, add http://
  const backendBase = apiUrl.startsWith('http') ? apiUrl : `http://${apiUrl}`
  const backendUrl = `${backendBase}/api/v1/${path}${url.search}`
  
  console.log(`[API Proxy] ${method} ${path} -> ${backendUrl}`)
  
  try {
    // Get request body if present
    let body: string | undefined
    if (method !== 'GET' && method !== 'DELETE') {
      try {
        body = await request.text()
      } catch {
        // No body
      }
    }
    
    // Forward request to backend
    const response = await fetch(backendUrl, {
      method,
      headers: {
        // Forward all headers except host
        ...Object.fromEntries(
          Array.from(request.headers.entries()).filter(([key]) => 
            key.toLowerCase() !== 'host'
          )
        ),
      },
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
      // Skip headers that Next.js manages
      if (
        key.toLowerCase() !== 'content-encoding' &&
        key.toLowerCase() !== 'transfer-encoding'
      ) {
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
