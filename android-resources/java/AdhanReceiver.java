package com.siraj.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/** يستقبل المنبّه عند وقت الصلاة ويبدأ خدمة تشغيل الأذان. */
public class AdhanReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !AdhanStore.ACTION_FIRE.equals(intent.getAction())) return;
        Intent s = new Intent(context, AdhanService.class);
        s.putExtra("title", intent.getStringExtra("title"));
        s.putExtra("body", intent.getStringExtra("body"));
        try {
            if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(s);
            else context.startService(s);
        } catch (Exception e) {
            AdhanService.postPlain(context, intent.getStringExtra("title"), intent.getStringExtra("body"));
        }
    }
}
