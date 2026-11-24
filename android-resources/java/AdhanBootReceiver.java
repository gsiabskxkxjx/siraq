package com.siraj.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** بعد إعادة تشغيل الهاتف أو تحديث التطبيق: يعيد ضبط منبّهات الأذان المخزَّنة. */
public class AdhanBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        AdhanStore.scheduleAll(context);
    }
}
