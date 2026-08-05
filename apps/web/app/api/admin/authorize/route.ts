import { NextResponse, type NextRequest } from 'next/server';

import {
  createSupabaseAdminClient,
  getAdminEmailAllowlist,
} from '../../../../lib/supabase-admin';

export async function POST(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  const accessToken = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null;

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Authentication is required.' },
      { status: 401 },
    );
  }

  try {
    const supabase = createSupabaseAdminClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(accessToken);

    if (error || !user || user.is_anonymous || !user.email) {
      return NextResponse.json(
        { error: 'A verified email is required.' },
        { status: 401 },
      );
    }

    const allowed = getAdminEmailAllowlist().has(user.email.toLowerCase());
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        app_metadata: {
          ...user.app_metadata,
          reflow_admin: allowed,
        },
      },
    );

    if (updateError) {
      return NextResponse.json(
        { error: 'Administrator access could not be updated.' },
        { status: 500 },
      );
    }

    if (!allowed) {
      return NextResponse.json(
        { error: 'This email is not on the local administrator allowlist.' },
        { status: 403 },
      );
    }

    return NextResponse.json({ allowed: true });
  } catch {
    return NextResponse.json(
      { error: 'Reflow administrator settings are not configured.' },
      { status: 503 },
    );
  }
}
