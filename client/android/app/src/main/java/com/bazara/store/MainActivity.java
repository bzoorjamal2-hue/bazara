package com.bazara.store;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // تثبيت تكبير الخط على 100% كي لا يكبّر أندرويد المحتوى حسب إعداد حجم الخط/العرض بالنظام.
        // (iOS يثبّت 100% افتراضياً) — فتتطابق أحجام الأيقونات والهدر والشريط السفلي بين المنصّتين.
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().getSettings().setTextZoom(100);
        }
    }
}
