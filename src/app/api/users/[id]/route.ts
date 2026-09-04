import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isSuperAdmin, getUserSession, hashPassword, passwordProblem } from '@/lib/auth';

function forbidden() {
  return NextResponse.json(
    { success: false, message: 'هذي الصفحة للسوبر أدمن فقط' },
    { status: 403 }
  );
}

/** Change a club account: rename, reset its password, enable or disable it. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSuperAdmin(req)) return forbidden();

  try {
    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ success: false, message: 'معرّف غير صالح' }, { status: 400 });
    }

    const body = await req.json();
    const updates: Record<string, any> = {};

    if (typeof body.clubName === 'string' && body.clubName.trim().length >= 2) {
      updates.club_name = body.clubName.trim();
    }

    if (typeof body.active === 'boolean') {
      updates.active = body.active;
    }

    if (body.password) {
      const problem = passwordProblem(body.password);
      if (problem) return NextResponse.json({ success: false, message: problem }, { status: 400 });
      updates.password_hash = await hashPassword(body.password);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, message: 'لا يوجد تغيير' }, { status: 400 });
    }

    // Never let the super admin lock itself out of its own account.
    const session = getUserSession(req);
    const { data: target } = await supabaseAdmin
      .from('app_users')
      .select('id, username, role')
      .eq('id', userId)
      .maybeSingle();

    if (!target) {
      return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 });
    }

    if (
      target.role === 'super_admin' &&
      updates.active === false &&
      target.username === session?.username
    ) {
      return NextResponse.json(
        { success: false, message: 'لا يمكنك تعطيل حسابك أنت' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('app_users')
      .update(updates)
      .eq('id', userId)
      .select('id, username, role, club_name, active, created_at')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'تم حفظ التعديل', user: data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'تعذر تعديل الحساب: ' + error.message },
      { status: 500 }
    );
  }
}

/** Remove a club account. Its finished sessions stay in the database. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSuperAdmin(req)) return forbidden();

  try {
    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ success: false, message: 'معرّف غير صالح' }, { status: 400 });
    }

    const { data: target } = await supabaseAdmin
      .from('app_users')
      .select('id, role')
      .eq('id', userId)
      .maybeSingle();

    if (!target) {
      return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 });
    }

    if (target.role === 'super_admin') {
      return NextResponse.json(
        { success: false, message: 'لا يمكن حذف حساب سوبر أدمن. عطّله بدلاً من ذلك.' },
        { status: 400 }
      );
    }

    const { data: deleted, error } = await supabaseAdmin
      .from('app_users')
      .delete()
      .eq('id', userId)
      .select('id');

    if (error) throw error;

    if (!deleted || deleted.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            'لم يتم الحذف. قاعدة البيانات ترفض الحذف لجدول app_users — راجع سياسات Supabase.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'تم حذف الحساب' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'تعذر حذف الحساب: ' + error.message },
      { status: 500 }
    );
  }
}
