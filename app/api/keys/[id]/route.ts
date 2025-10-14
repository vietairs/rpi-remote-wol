import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { apiKeyDb } from '@/lib/db';

// DELETE /api/keys/[id] - Revoke an API key
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const keyId = parseInt(params.id, 10);
    if (isNaN(keyId)) {
      return NextResponse.json(
        { error: 'Invalid API key ID' },
        { status: 400 }
      );
    }

    // Verify the key belongs to the current user
    const userKeys = apiKeyDb.getAllForUser(session.userId);
    const keyExists = userKeys.some(k => k.id === keyId);

    if (!keyExists) {
      return NextResponse.json(
        { error: 'API key not found or unauthorized' },
        { status: 404 }
      );
    }

    // Delete the key
    const deleted = apiKeyDb.deleteById(keyId);

    if (deleted) {
      return NextResponse.json({
        success: true,
        message: 'API key revoked successfully',
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to revoke API key' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error revoking API key:', error);
    return NextResponse.json(
      { error: 'Failed to revoke API key' },
      { status: 500 }
    );
  }
}
