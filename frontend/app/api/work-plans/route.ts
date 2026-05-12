import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';
import { createErrorResponse, createInternalServerErrorResponse } from '@/lib/api';

const API_BASE_URL = config.api.baseUrl;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = new URLSearchParams();
    
    // Forward query parameters
    if (searchParams.get('date')) {
      params.append('date', searchParams.get('date')!);
    }

    // console.log('[DEBUG] Frontend API - Date parameter:', searchParams.get('date'));
    // console.log('[DEBUG] Frontend API - All search params:', Object.fromEntries(searchParams.entries()));
    // console.log('[DEBUG] Frontend API - Backend URL:', `${API_BASE_URL}/api/work-plans?${params}`);

    const response = await fetch(`${API_BASE_URL}/api/work-plans?${params}`);
    
    // ตรวจสอบ HTTP status ก่อน
    if (!response.ok) {
      // console.error('[DEBUG] Backend returned error status:', response.status);
      
      // ลองอ่าน response text เพื่อดู error message
      const errorText = await response.text();
      // console.error('[DEBUG] Backend error response:', errorText);
      
      return NextResponse.json(
        { 
          success: false, 
          message: `Backend error: ${response.status} - ${errorText}`,
          error: errorText
        },
        { status: response.status }
      );
    }
    
    // ตรวจสอบว่า response เป็น JSON หรือไม่
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const textResponse = await response.text();
      // console.error('[DEBUG] Backend returned non-JSON response:', textResponse);
      
      return NextResponse.json(
        { 
          success: false, 
          message: 'Backend returned non-JSON response',
          error: textResponse
        },
        { status: 500 }
      );
    }
    
    const data = await response.json();
    // console.log('[DEBUG] Frontend API - Backend response:', data);
    
    // เพิ่ม cache headers สำหรับข้อมูลที่ไม่เปลี่ยนบ่อย
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (error) {
    const err = error as Error;
    console.error('Error fetching work plans:', err.message, err.cause);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch work plans',
        detail: err.message,
        hint: 'ตรวจสอบว่า Backend รันอยู่ที่ ' + API_BASE_URL + ' หรือไม่'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const response = await fetch(`${API_BASE_URL}/api/work-plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend API error:', response.status, errorText);
      return NextResponse.json(
        { success: false, message: `Backend API error: ${response.status} ${errorText}` },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating work plan:', error);
    const errorResponse = createInternalServerErrorResponse(error);
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
