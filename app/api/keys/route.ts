import { NextRequest, NextResponse } from 'next/server';
import { getSession, generateApiKey, hashApiKey } from '@/lib/auth';
import { apiKeyDb } from '@/lib/db';

// POST /api/keys - Generate new API key
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'API key name is required' },
        { status: 400 }
      );
    }

    // Generate new API key (32-byte hex = 64 characters)
    const apiKey = generateApiKey();

    // Hash the API key before storing
    const keyHash = await hashApiKey(apiKey);

    // Store in database
    const record = apiKeyDb.create({
      key_hash: keyHash,
      name: name.trim(),
      created_by: session.userId,
    });

    // Return the API key ONLY THIS ONE TIME
    return NextResponse.json({
      id: record.id,
      name: record.name,
      key: apiKey, // WARNING: This is the only time the key is shown
      created_at: record.created_at,
      message: 'Save this key securely - it will not be shown again',
    });
  } catch (error) {
    console.error('Error creating API key:', error);
    return NextResponse.json(
      { error: 'Failed to create API key' },
      { status: 500 }
    );
  }
}

// GET /api/keys - List user's API keys (without the actual keys)
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const keys = apiKeyDb.getAllForUser(session.userId);

    return NextResponse.json({ keys });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API keys' },
      { status: 500 }
    );
  }
}
