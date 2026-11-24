package com.siraj.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;
import java.io.File;

/**
 * يشغّل الأذان عبر قناة صوت «المنبّه» (USAGE_ALARM): يُسمع والهاتف على الصامت،
 * وفي «عدم الإزعاج» يُسمع ما دام استثناء المنبّهات مفعّلاً (وهو الافتراضي).
 * إن لم يوجد ملف أذان يُعرض إشعار عادي بصوت الهاتف.
 */
public class AdhanService extends Service {
    static final String CH_PLAY = "siraj_adhan_play";
    static final String CH_DONE = "siraj_adhan_done";
    static final String CH_PLAIN = "siraj_adhan_plain";
    static final String ACTION_STOP = "com.siraj.app.ADHAN_STOP";
    static final int NID = 7001;
    static final int NID_DONE = 7002;
    static final long MAX_MS = 8 * 60 * 1000L;

    private MediaPlayer mp;
    private PowerManager.WakeLock wl;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private String title = "", body = "";
    private boolean finished = false;

    static void stop(Context c) {
        try {
            Intent i = new Intent(c, AdhanService.class);
            i.setAction(ACTION_STOP);
            c.startService(i);
        } catch (Exception ignored) {
        }
    }

    private static void ensureChannels(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        NotificationChannel play = new NotificationChannel(CH_PLAY, "تشغيل الأذان", NotificationManager.IMPORTANCE_HIGH);
        play.setSound(null, null);
        play.enableVibration(false);
        nm.createNotificationChannel(play);
        NotificationChannel done = new NotificationChannel(CH_DONE, "وقت الصلاة", NotificationManager.IMPORTANCE_LOW);
        done.setSound(null, null);
        nm.createNotificationChannel(done);
        NotificationChannel plain = new NotificationChannel(CH_PLAIN, "وقت الصلاة (صوت الهاتف)", NotificationManager.IMPORTANCE_HIGH);
        nm.createNotificationChannel(plain);
    }

    private static int smallIcon(Context c) {
        int id = c.getResources().getIdentifier("ic_stat_siraj", "drawable", c.getPackageName());
        return id != 0 ? id : android.R.drawable.ic_lock_idle_alarm;
    }

    private static PendingIntent openApp(Context c) {
        Intent l = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        if (l == null) return null;
        int f = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) f |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(c, 0, l, f);
    }

    /** إشعار عادي (بصوت الهاتف) عند غياب ملف الأذان أو تعذّر الخدمة. */
    static void postPlain(Context c, String title, String body) {
        try {
            ensureChannels(c);
            NotificationCompat.Builder b = new NotificationCompat.Builder(c, CH_PLAIN)
                    .setSmallIcon(smallIcon(c))
                    .setContentTitle(title == null ? "" : title)
                    .setContentText(body == null ? "" : body)
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setCategory(NotificationCompat.CATEGORY_ALARM)
                    .setDefaults(Notification.DEFAULT_ALL)
                    .setAutoCancel(true);
            PendingIntent op = openApp(c);
            if (op != null) b.setContentIntent(op);
            ((NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).notify(NID_DONE, b.build());
        } catch (Exception ignored) {
        }
    }

    private void postDone() {
        try {
            NotificationCompat.Builder b = new NotificationCompat.Builder(this, CH_DONE)
                    .setSmallIcon(smallIcon(this))
                    .setContentTitle(title)
                    .setContentText(body)
                    .setAutoCancel(true);
            PendingIntent op = openApp(this);
            if (op != null) b.setContentIntent(op);
            ((NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE)).notify(NID_DONE, b.build());
        } catch (Exception ignored) {
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            finishNow(false);
            return START_NOT_STICKY;
        }
        title = intent != null && intent.getStringExtra("title") != null ? intent.getStringExtra("title") : "";
        body = intent != null && intent.getStringExtra("body") != null ? intent.getStringExtra("body") : "";
        ensureChannels(this);

        Intent st = new Intent(this, AdhanService.class);
        st.setAction(ACTION_STOP);
        int pf = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) pf |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent stopPi = PendingIntent.getService(this, 1, st, pf);
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CH_PLAY)
                .setSmallIcon(smallIcon(this))
                .setContentTitle(title)
                .setContentText(body)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .addAction(0, "إيقاف الأذان", stopPi);
        PendingIntent op = openApp(this);
        if (op != null) b.setContentIntent(op);
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                startForeground(NID, b.build(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(NID, b.build());
            }
        } catch (Exception e) {
            postPlain(this, title, body);
            stopSelf();
            return START_NOT_STICKY;
        }

        File f = AdhanStore.audioFile(this);
        if (!f.exists() || f.length() == 0) {
            finishNow(true);
            return START_NOT_STICKY;
        }
        play(f);
        return START_NOT_STICKY;
    }

    private void play(File f) {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "siraj:adhan");
            wl.acquire(MAX_MS + 30000L);
        } catch (Exception ignored) {
        }
        try {
            mp = new MediaPlayer();
            mp.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build());
            mp.setDataSource(f.getAbsolutePath());
            mp.setOnPreparedListener(new MediaPlayer.OnPreparedListener() {
                @Override
                public void onPrepared(MediaPlayer m) {
                    m.start();
                }
            });
            mp.setOnCompletionListener(new MediaPlayer.OnCompletionListener() {
                @Override
                public void onCompletion(MediaPlayer m) {
                    finishNow(false);
                }
            });
            mp.setOnErrorListener(new MediaPlayer.OnErrorListener() {
                @Override
                public boolean onError(MediaPlayer m, int what, int extra) {
                    finishNow(true);
                    return true;
                }
            });
            mp.prepareAsync();
            handler.postDelayed(new Runnable() {
                @Override
                public void run() {
                    finishNow(false);
                }
            }, MAX_MS);
        } catch (Exception e) {
            finishNow(true);
        }
    }

    /** plain=true: لم يُسمع الأذان (لا ملف/خطأ) فنعرض إشعاراً بصوت الهاتف. */
    private void finishNow(boolean plain) {
        if (finished) return;
        finished = true;
        handler.removeCallbacksAndMessages(null);
        try {
            if (mp != null) {
                try {
                    mp.stop();
                } catch (Exception ignored) {
                }
                mp.release();
                mp = null;
            }
        } catch (Exception ignored) {
        }
        try {
            if (wl != null && wl.isHeld()) wl.release();
        } catch (Exception ignored) {
        }
        try {
            stopForeground(true);
        } catch (Exception ignored) {
        }
        if (plain) postPlain(this, title, body);
        else if (title.length() > 0) postDone();
        stopSelf();
    }

    @Override
    public void onDestroy() {
        if (!finished) {
            finished = true;
            handler.removeCallbacksAndMessages(null);
            try {
                if (mp != null) mp.release();
            } catch (Exception ignored) {
            }
            try {
                if (wl != null && wl.isHeld()) wl.release();
            } catch (Exception ignored) {
            }
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
