export const dynamic = 'force-dynamic';
// app/api/medications/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 오늘의 약 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || '00000000-0000-0000-0000-000000000001';

    // 오늘 복용해야 할 약 목록 조회 (RPC 함수 호출)
    const { data: todayMeds, error: todayError } = await supabase
      .rpc('get_today_medications', { p_user_id: userId });

    if (todayError) {
      console.error('오늘 약 목록 조회 실패:', todayError);
      
      // RPC 함수가 없는 경우 직접 조회
      const { data: medications, error: medsError } = await supabase
        .from('medications')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('medication_name');

      if (medsError) {
        throw medsError;
      }

      // 오늘 복용 기록 조회
      const today = new Date().toISOString().split('T')[0];
      const { data: logs, error: logsError } = await supabase
        .from('medication_logs')
        .select('*')
        .eq('date', today);

      // 각 약의 알람 시간별로 복용 여부 확인
      const todayList: any[] = [];
      medications?.forEach(med => {
        const alarmTimes = med.alarm_times || [];
        alarmTimes.forEach((time: string) => {
          const isTaken = logs?.some(
            log => log.medication_id === med.id && log.scheduled_time === time
          );
          todayList.push({
            medication_id: med.id,
            medication_name: med.medication_name,
            dosage: med.dosage,
            scheduled_time: time,
            is_taken: isTaken || false,
          });
        });
      });

      // 시간순 정렬
      todayList.sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time));

      return NextResponse.json({
        medications: medications || [],
        todaySchedule: todayList,
        date: today,
      });
    }

    // 모든 약 목록도 함께 반환
    const { data: medications } = await supabase
      .from('medications')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('medication_name');

    return NextResponse.json({
      medications: medications || [],
      todaySchedule: todayMeds || [],
      date: new Date().toISOString().split('T')[0],
    });

  } catch (error) {
    console.error('약 목록 조회 오류:', error);
    return NextResponse.json(
      { error: '약 목록을 불러오는 데 실패했습니다' },
      { status: 500 }
    );
  }
}

// 새 약 등록
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, medicationName, dosage, alarmTimes } = body;

    if (!medicationName || !alarmTimes) {
      return NextResponse.json(
        { error: '약 이름과 알람 시간은 필수입니다' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('medications')
      .insert({
        user_id: userId || '00000000-0000-0000-0000-000000000001',
        medication_name: medicationName,
        dosage: dosage || '1알',
        alarm_times: alarmTimes,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      medication: data,
    });

  } catch (error) {
    console.error('약 등록 오류:', error);
    return NextResponse.json(
      { error: '약 등록에 실패했습니다' },
      { status: 500 }
    );
  }
}

// 약 정보 수정
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: '약 ID가 필요합니다' },
        { status: 400 }
      );
    }

    // snake_case로 변환
    const updateData: any = {};
    if (updates.medicationName) updateData.medication_name = updates.medicationName;
    if (updates.dosage) updateData.dosage = updates.dosage;
    if (updates.alarmTimes) updateData.alarm_times = updates.alarmTimes;
    if (typeof updates.isActive === 'boolean') updateData.is_active = updates.isActive;

    const { data, error } = await supabase
      .from('medications')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      medication: data,
    });

  } catch (error) {
    console.error('약 수정 오류:', error);
    return NextResponse.json(
      { error: '약 정보 수정에 실패했습니다' },
      { status: 500 }
    );
  }
}

// 약 삭제 (비활성화)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: '약 ID가 필요합니다' },
        { status: 400 }
      );
    }

    // 실제 삭제 대신 비활성화
    const { error } = await supabase
      .from('medications')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: '약이 삭제되었습니다',
    });

  } catch (error) {
    console.error('약 삭제 오류:', error);
    return NextResponse.json(
      { error: '약 삭제에 실패했습니다' },
      { status: 500 }
    );
  }
}
