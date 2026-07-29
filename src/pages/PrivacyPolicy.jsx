import { Shield, Lock, Eye, Database, UserCheck, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PrivacyPolicy() {
  return (
    <div dir="rtl">
      <div className="max-w-4xl mx-auto px-4 py-8">

        <div className="bg-white rounded-[3px] border border-[#16233D]/12 p-8 space-y-8">
          <div className="text-center border-b pb-6">
            <div className="inline-flex items-center justify-center h-16 w-16 bg-[#A5813F]/15 rounded-full mb-4">
              <Shield className="h-8 w-8 text-[#A5813F]" />
            </div>
            <h1 className="text-3xl font-medium text-[#16233D]">سياسة الخصوصية</h1>
            <p className="text-gray-500 mt-2">آخر تحديث: يوليو ٢٠٢٦</p>
          </div>

          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <Database className="h-6 w-6 text-[#A5813F]" />
              <h2 className="text-xl font-medium text-[#16233D]">البيانات التي نجمعها</h2>
            </div>
            <p className="text-gray-700 leading-relaxed">
              نجمع المعلومات التي تقدمها لنا مباشرة عند استخدام خدمتنا، بما في ذلك:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 mr-4">
              <li>معلومات الحساب (البريد الإلكتروني، رقم الهاتف، اسم المستخدم)</li>
              <li>بيانات شجرة العائلة (الأسماء، تواريخ الميلاد والوفاة، العلاقات الأسرية)</li>
              <li>سجلات الاستخدام والنشاط</li>
            </ul>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <Lock className="h-6 w-6 text-[#A5813F]" />
              <h2 className="text-xl font-medium text-[#16233D]">كيف نحمي بياناتك</h2>
            </div>
            <p className="text-gray-700 leading-relaxed">
              نستخدم إجراءات أمنية متقدمة لحماية معلوماتك الشخصية:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 mr-4">
              <li>تشفير البيانات أثناء النقل</li>
              <li>
                تشفير بيانات أفراد العائلة الحساسة (أرقام الهواتف، البريد
                الإلكتروني، أرقام الهوية) في قاعدة البيانات
              </li>
              <li>
                يُحفظ بريدك الإلكتروني أو رقم هاتفك المستخدم لتسجيل الدخول دون
                تشفير، لأنه يُستخدم للتعرّف على حسابك عند الدخول
              </li>
              <li>مصادقة آمنة للحسابات</li>
              <li>تخزين رموز الجلسة في ملفات تعريف ارتباط محمية</li>
              <li>سجلات تدقيق للعمليات الحساسة</li>
            </ul>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <Eye className="h-6 w-6 text-[#A5813F]" />
              <h2 className="text-xl font-medium text-[#16233D]">كيف نستخدم بياناتك</h2>
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
              <UserCheck className="h-6 w-6 text-[#A5813F]" />
              <h2 className="text-xl font-medium text-[#16233D]">حقوقك</h2>
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
            <h2 className="text-xl font-medium text-[#16233D]">مشاركة البيانات مع أطراف ثالثة</h2>
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
            <h2 className="text-xl font-medium text-[#16233D]">ملفات تعريف الارتباط</h2>
            <p className="text-gray-700 leading-relaxed">
              نستخدم ملفات تعريف الارتباط الضرورية لتشغيل التطبيق وتأمين جلسة المستخدم. 
              هذه الملفات ضرورية لعمل التطبيق بشكل صحيح ولا يمكن تعطيلها.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-medium text-[#16233D]">الاحتفاظ بالبيانات</h2>
            <p className="text-gray-700 leading-relaxed">
              نحتفظ ببياناتك طالما أن حسابك نشط. عند حذف حسابك، نحذف جميع بياناتك الشخصية 
              وبيانات شجرة العائلة خلال 30 يومًا، باستثناء ما يلزمنا الاحتفاظ به بموجب القانون.
            </p>
          </section>

          <section className="space-y-4 bg-[#EDE6D6] rounded-[3px] p-6">
            <div className="flex items-center gap-3">
              <Mail className="h-6 w-6 text-[#A5813F]" />
              <h2 className="text-xl font-medium text-[#16233D]">تواصل معنا</h2>
            </div>
            <p className="text-gray-700 leading-relaxed">
              إذا كانت لديك أي أسئلة حول سياسة الخصوصية هذه أو ممارسات البيانات لدينا، 
              يرجى التواصل معنا عبر:
            </p>
            <p className="text-[#A5813F] font-medium">
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
