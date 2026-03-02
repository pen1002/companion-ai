// app/api/medications/taken/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 약 복용 완료 기록
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { medicationId, scheduledTime } = body;

    if (!medicationId) {
      return NextResponse.json(
        { error: '약 ID가 필요합니다' },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    // RPC 함수 호출 시도
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('mark_medication_taken', {
        p_medication_id: medicationId,
        p_scheduled_time: scheduledTime || new Date().toTimeString().slice(0, 5),
      });

    if (rpcError) {
      console.warn('RPC 함수 실패, 직접 처리:', rpcError);

      // 복용 기록 추가
      const { error: logError } = await supabase
        .from('medication_logs')
        .upsert({
          medication_id: medicationId,
          scheduled_time: scheduledTime || new Date().toTimeString().slice(0, 5),
          taken_at: now,
          date: today,
        }, {
          onConflict: 'medication_id,date,scheduled_time',
        });

      if (logError) {
        console.error('복용 기록 추가 실패:', logError);
      }

      // 마지막 복용 시간 업데이트
      const { error: updateError } = await supabase
        .from('medications')
        .update({ last_taken_at: now })
        .eq('id', medicationId);

      if (updateError) {
        console.error('마지막 복용 시간 업데이트 실패:', updateError);
      }
    }

    // 약 정보 조회
    const { data: medication } = await supabase
      .from('medications')
      .select('medication_name, dosage')
      .eq('id', medicationId)
      .single();

    return NextResponse.json({
      success: true,
      message: '약 복용이 기록되었습니다',
      medication: medication,
      takenAt: now,
    });

  } catch (error) {
    console.error('약 복용 기록 오류:', error);
    return NextResponse.json(
      { error: '약 복용 기록에 실패했습니다' },
      { status: 500 }
    );
  }
}

// 오늘 복용 기록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || '00000000-0000-0000-0000-000000000001';
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // 해당 사용자의 약 목록 조회
    const { data: medications, error: medsError } = await supabase
      .from('medications')
      .select('id, medication_name, dosage, alarm_times')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (medsError) {
      throw medsError;
    }

    // 해당 날짜의 복용 기록 조회
    const { data: logs, error: logsError } = await supabase
      .from('medication_logs')
      .select('*')
      .eq('date', date)
      .in('medication_id', medications?.map(m => m.id) || []);

    if (logsError) {
      throw logsError;
    }

    // 각 약별 복용 현황 계산
    const status = medications?.map(med => {
      const alarmTimes: string[] = med.alarm_times || [];
      const takenTimes = logs?.filter(log => log.medication_id === med.id) || [];
      
      return {
        medicationId: med.id,
        medicationName: med.medication_name,
        dosage: med.dosage,
        totalDoses: alarmTimes.length,
        takenDoses: takenTimes.length,
        schedule: alarmTimes.map(time => ({
          time,
          taken: takenTimes.some(log => log.scheduled_time === time),
          takenAt: takenTimes.find(log => log.scheduled_time === time)?.taken_at,
        })),
      };
    });

    return NextResponse.json({
      date,
      medications: status,
      summary: {
        totalMedications: medications?.length || 0,
        totalDoses: status?.reduce((sum, m) => sum + m.totalDoses, 0) || 0,
        takenDoses: status?.reduce((sum, m) => sum + m.takenDoses, 0) || 0,
      },
    });

  } catch (error) {
    console.error('복용 기록 조회 오류:', error);
    return NextResponse.json(
      { error: '복용 기록을 불러오는 데 실패했습니다' },
      { status: 500 }
    );
  }
}
