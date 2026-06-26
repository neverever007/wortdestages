// Supabase Edge Function: monthly-recap
// Wird per Cron-Job (pg_cron oder Supabase Scheduled Function) am 1. jeden Monats ausgeführt.
// Erstellt pro Nutzer ein PDF mit allen Wörtern des Vormonats und sendet eine Push-Benachrichtigung.
//
// Deployment: supabase functions deploy monthly-recap
// Scheduling (SQL, einmalig in der Supabase SQL-Konsole ausführen):
//   select cron.schedule('monthly-recap-job', '0 6 1 * *',
//     $$ select net.http_post(url:='https://DEIN-PROJEKT.supabase.co/functions/v1/monthly-recap') $$
//   );

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0';
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async () => {
  const now = new Date();
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastOfLastMonth = new Date(firstOfThisMonth.getTime() - 1);

  const monthStartIso = firstOfLastMonth.toISOString().slice(0, 10);
  const monthEndIso = lastOfLastMonth.toISOString().slice(0, 10);

  // Alle Wörter des Vormonats laden
  const { data: words } = await supabase
    .from('words')
    .select('*')
    .gte('datum', monthStartIso)
    .lte('datum', monthEndIso)
    .order('datum', { ascending: true });

  if (!words || words.length === 0) {
    return new Response(JSON.stringify({ skipped: true, reason: 'Keine Wörter im Vormonat' }), {
      status: 200,
    });
  }

  // Alle Nutzer laden, die benachrichtigt werden möchten
  const { data: users } = await supabase
    .from('profiles')
    .select('id, name, expo_push_token, notifications_enabled')
    .eq('notifications_enabled', true);

  const monthLabel = firstOfLastMonth.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  for (const user of users ?? []) {
    // PDF erzeugen
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    let page = pdfDoc.addPage([420, 595]);
    page.drawText(`Deine Wörter im ${monthLabel}`, { x: 40, y: 540, size: 20, font, color: rgb(0.12, 0.1, 0.08) });

    let y = 500;
    for (const word of words) {
      if (y < 80) {
        page = pdfDoc.addPage([420, 595]);
        y = 540;
      }
      page.drawText(word.wort, { x: 40, y, size: 14, font, color: rgb(0.71, 0.31, 0.18) });
      y -= 18;
      const defLines = wrapText(word.definition, 60);
      for (const line of defLines) {
        page.drawText(line, { x: 40, y, size: 10, font: fontRegular, color: rgb(0.36, 0.33, 0.28) });
        y -= 14;
      }
      y -= 14;
    }

    const pdfBytes = await pdfDoc.save();
    const filePath = `recaps/${user.id}/${monthStartIso}.pdf`;

    await supabase.storage.from('monthly-recaps').upload(filePath, pdfBytes, {
      contentType: 'application/pdf',
      upsert: true,
    });

    const { data: publicUrlData } = supabase.storage.from('monthly-recaps').getPublicUrl(filePath);

    await supabase.from('monthly_recaps').upsert({
      user_id: user.id,
      monat: monthStartIso,
      pdf_url: publicUrlData.publicUrl,
    });

    // Push-Benachrichtigung über Expo Push Service
    if (user.expo_push_token) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: user.expo_push_token,
          title: `Deine Rückschau für ${monthLabel} ist da 📖`,
          body: `${words.length} Wörter warten auf dich zum Herunterladen.`,
          data: { type: 'monthly_recap' },
        }),
      });
    }
  }

  return new Response(JSON.stringify({ success: true, processedUsers: users?.length ?? 0 }), {
    status: 200,
  });
});

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxCharsPerLine) {
      lines.push(current.trim());
      current = word;
    } else {
      current += ' ' + word;
    }
  }
  if (current.trim()) lines.push(current.trim());
  return lines;
}
