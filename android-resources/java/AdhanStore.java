package com.siraj.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import java.io.File;
import org.json.JSONArray;
import org.json.JSONObject;

/** تخزين جدول الأذان وملف الصوت، وضبط المنبّهات (AlarmManager). */
final class AdhanStore {
    static final String PREFS = "siraj_adhan";
    static final String ACTION_FIRE = "com.siraj.app.ADHAN_FIRE";

    private AdhanStore() {}

    static File audioFile(Context c) {
        return new File(c.getFilesDir(), "adhan_audio.bin");
    }

    static void saveItems(Context c, String json) {
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("items", json).apply();
    }

    static JSONArray loadItems(Context c) {
        try {
            String s = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("items", "[]");
            return new JSONArray(s);
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    private static int flags() {
        int f = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) f |= PendingIntent.FLAG_IMMUTABLE;
        return f;
    }

    private static PendingIntent pi(Context c, int id, String title, String body) {
        Intent i = new Intent(c, AdhanReceiver.class);
        i.setAction(ACTION_FIRE);
        i.putExtra("title", title == null ? "" : title);
        i.putExtra("body", body == null ? "" : body);
        return PendingIntent.getBroadcast(c, id, i, flags());
    }

    static void cancelAll(Context c) {
        try {
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            JSONArray a = loadItems(c);
            for (int k = 0; k < a.length(); k++) {
                JSONObject o = a.optJSONObject(k);
                if (o == null) continue;
                int id = o.optInt("id");
                PendingIntent p = pi(c, id, o.optString("title"), o.optString("body"));
                am.cancel(p);
                p.cancel();
            }
        } catch (Exception ignored) {
        }
    }

    /** يضبط كل منبّهات المستقبل المخزَّنة؛ يُرجع عدد ما ضُبط. */
    static int scheduleAll(Context c) {
        int n = 0;
        try {
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            JSONArray a = loadItems(c);
            long now = System.currentTimeMillis();
            boolean canExact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
            for (int k = 0; k < a.length(); k++) {
                JSONObject o = a.optJSONObject(k);
                if (o == null) continue;
                long at = o.optLong("at");
                if (at <= now + 500) continue;
                int id = o.optInt("id");
                PendingIntent p = pi(c, id, o.optString("title"), o.optString("body"));
                try {
                    if (canExact && Build.VERSION.SDK_INT >= 23) {
                        am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, p);
                    } else if (Build.VERSION.SDK_INT >= 23) {
                        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, p);
                    } else {
                        am.set(AlarmManager.RTC_WAKEUP, at, p);
                    }
                    n++;
                } catch (SecurityException se) {
                    try {
                        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, p);
                        n++;
                    } catch (Exception ignored) {
                    }
                }
            }
        } catch (Exception ignored) {
        }
        return n;
    }

    static boolean canExact(Context c) {
        try {
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            return Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
        } catch (Exception e) {
            return false;
        }
    }
}
