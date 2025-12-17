import { Link } from 'react-router-dom';
import { ArrowRight, Shield, Lock, Eye, Database, UserCheck, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white" dir="rtl">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link to="/">
          <Button variant="ghost" className="mb-6 gap-2">
            <ArrowRight className="h-4 w-4" />
            العودة للرئيسية
          </Button>
        </Link>

        <div className="bg-white rounded-2xl shadow-lg p-8 space-y-8">
          <div className="text-center border-b pb-6">
            <div className="inline-flex items-center justify-center h-16 w-16 bg-purple-100 rounded-full mb-4">
              <Shield className="h-8 w-8 text-purple-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">سياسة الخصوصية</h1>
            <p className="text-gray-500 mt-2">آخر تحديث: ديسمبر 2024</p>
          </div>

          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <Database className="h-6 w-6 text-purple-600" />
              <h2 className="text-xl font-semibold">البيانات التي نجمعها</h2>
            </div>
            <p className="text-gray-700 leading-relaxed">
              نجمع المعلومات التي تقدمها لنا مباشرة عند استخدام خدمتنا، بما في ذلك:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 mr-4">
              <li>معلومات الحساب (البريد الإلكتروني، رقم الهاتف، اسم المستخدم)</li>
              <li>بيانات شجرة العائلة (الأسماء، تواريخ الميلاد والوفاة، العلاقات الأسرية)</li>
              <li>الصور التي ترفعها لأفراد العائلة</li>
              <li>سجلات الاستخدام والنشاط</li>
            </ul>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <Lock className="h-6 w-6 text-purple-600" />
              <h2 className="text-xl font-semibold">كيف نحمي بياناتك</h2>
            </div>
            <p className="text-gray-700 leading-relaxed">
              نستخدم إجراءات أمنية متقدمة لحماية معلوماتك الشخصية:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 mr-4">
              <li>تشفير البيانات أثناء النقل باستخدام HTTPS/TLS</li>
              <li>تشفير المعلومات الحساسة (أرقام الهواتف، البريد الإلكتروني، أرقام الهوية) في قاعدة البيانات</li>
              <li>المصادقة الآمنة عبر Firebase وJWT</li>
              <li>تخزين رموز المصادقة في ملفات تعريف ارتباط آمنة (HttpOnly)</li>
              <li>سجلات تدقيق للعمليات الحساسة</li>
            </ul>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <Eye className="h-6 w-6 text-purple-600" />
              <h2 className="text-xl font-semibold">كيف نستخدم بياناتك</h2>
            </div>
            <p className="text-gray-700 leading-relaxed">
              نستخدم المعلومات التي نجمعها للأغراض التالية:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 mr-4">
              <li>توفير خدمة شجرة العائلة وتشغيلها</li>
              <li>التحقق من هويتك وتأمين حسابك</li>
              <li>تحسين تجربة المستخدم</li>
              <li>التواصل معك بخصوص حسابك</li>
              <li>الامتثال للمتطلبات القانونية</li>
            </ul>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <UserCheck className="h-6 w-6 text-purple-600" />
              <h2 className="text-xl font-semibold">حقوقك</h2>
            </div>
            <p className="text-gray-700 leading-relaxed">
              لديك الحقوق التالية فيما يتعلق ببياناتك الشخصية:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 mr-4">
              <li><strong>الوصول:</strong> يمكنك طلب نسخة من بياناتك في أي وقت</li>
              <li><strong>التصحيح:</strong> يمكنك تعديل بياناتك من خلال التطبيق</li>
              <li><strong>الحذف:</strong> يمكنك حذف حسابك وجميع بياناتك</li>
              <li><strong>التصدير:</strong> يمكنك تصدير بيانات شجرة العائلة بتنسيقات متعددة</li>
              <li><strong>الإلغاء:</strong> يمكنك سحب موافقتك في أي وقت</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">مشاركة البيانات مع أطراف ثالثة</h2>
            <p className="text-gray-700 leading-relaxed">
              لا نبيع أو نؤجر بياناتك الشخصية لأي طرف ثالث. قد نشارك بياناتك فقط في الحالات التالية:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 mr-4">
              <li>مع موفري الخدمات الذين يساعدوننا في تشغيل التطبيق (Firebase، Twilio)</li>
              <li>عندما يكون ذلك مطلوبًا بموجب القانون</li>
              <li>بموافقتك الصريحة</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">ملفات تعريف الارتباط</h2>
            <p className="text-gray-700 leading-relaxed">
              نستخدم ملفات تعريف الارتباط الضرورية لتشغيل التطبيق وتأمين جلسة المستخدم. 
              هذه الملفات ضرورية لعمل التطبيق بشكل صحيح ولا يمكن تعطيلها.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">الاحتفاظ بالبيانات</h2>
            <p className="text-gray-700 leading-relaxed">
              نحتفظ ببياناتك طالما أن حسابك نشط. عند حذف حسابك، نحذف جميع بياناتك الشخصية 
              وبيانات شجرة العائلة خلال 30 يومًا، باستثناء ما يلزمنا الاحتفاظ به بموجب القانون.
            </p>
          </section>

          <section className="space-y-4 bg-purple-50 rounded-lg p-6">
            <div className="flex items-center gap-3">
              <Mail className="h-6 w-6 text-purple-600" />
              <h2 className="text-xl font-semibold">تواصل معنا</h2>
            </div>
            <p className="text-gray-700 leading-relaxed">
              إذا كانت لديك أي أسئلة حول سياسة الخصوصية هذه أو ممارسات البيانات لدينا، 
              يرجى التواصل معنا عبر:
            </p>
            <p className="text-purple-600 font-medium">
              support@uaeroots.com
            </p>
          </section>

          <div className="text-center pt-6 border-t">
            <p className="text-sm text-gray-500">
              جذور الإمارات - جميع الحقوق محفوظة © {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
