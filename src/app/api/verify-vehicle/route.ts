import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

function normalizeRegNumber(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const regNumber = normalizeRegNumber(body?.vehicle_reg_number ?? '');

  if (regNumber.length < 6) {
    return NextResponse.json({ error: 'Enter a valid registration number.' }, { status: 400 });
  }

  const apiKey = process.env.API_SETU_KEY;
  const apiUrl = process.env.API_SETU_RC_URL;

  if (!apiKey || !apiUrl) {
    await supabase
      .from('profiles')
      .update({
        vehicle_reg_number: regNumber,
        vehicle_verified: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    return NextResponse.json({
      verified: false,
      pending: true,
      message: 'Vehicle number saved. Add API_SETU_KEY and API_SETU_RC_URL to enable live RC verification.',
      vehicle_reg_number: regNumber,
    });
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({ registration_number: regNumber }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: 'Vehicle verification provider rejected the request.' }, { status: 502 });
  }

  const result = await response.json();
  const ownerName = String(result.owner_name ?? result.ownerName ?? '').toLowerCase();
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single();

  const profileName = String(profile?.full_name ?? '').toLowerCase();
  const verified = Boolean(ownerName && profileName && (ownerName.includes(profileName) || profileName.includes(ownerName)));

  await supabase
    .from('profiles')
    .update({
      vehicle_reg_number: regNumber,
      vehicle_verified: verified,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  return NextResponse.json({
    verified,
    vehicle_reg_number: regNumber,
    owner_name: result.owner_name ?? result.ownerName ?? null,
    vehicle_model: result.vehicle_model ?? result.vehicleModel ?? null,
  });
}
