import {
  Shield,
  Lock,
  Eye,
  Database,
  UserCheck,
  Mail,
  Share2,
  Cookie,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PrivacyPolicy() {
  // Dark, to match the landing page's privacy section: ink #16233d ground,
  // #ddd6c6 body, #f4efe3 headings, #c29e58 accents. Those live as CSS variables
  // on .lp, and this page renders outside it, so the values are written literally
  // rather than referenced.
  return (
    <div dir="rtl" className="lp-dark min-h-screen bg-[#16233D]">
      <div className="max-w-4xl mx-auto px-4 py-8">

        <div className="bg-[#1D2B47] rounded-[3px] border border-[#F4EFE3]/12 p-8 space-y-8">
          <div className="text-center border-b border-[#F4EFE3]/12 pb-6">
            <div className="inline-flex items-center justify-center h-16 w-16 bg-[#C29E58]/15 rounded-full mb-4">
              <Shield className="h-8 w-8 text-[#C29E58]" />
            </div>
            <h1 className="text-3xl font-medium text-[#F4EFE3]">سياسة الخصوصية</h1>
            <p className="text-[#9A9484] mt-2">آخر تحديث: يوليو ٢٠٢٦</p>
          </div>

          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <Database className="h-6 w-6 text-[#C29E58]" />
              <h2 className="text-xl font-medium text-[#F4EFE3]">البيانات التي نجمعها</h2>
            </div>
            <p className="text-[#DDD6C6] leading-relaxed">
              نجمع المعلومات التي تقدمها لنا مباشرة عند استخدام خدمتنا، بما في ذلك:
            </p>
            <ul className="list-disc list-inside space-y-2 text-[#DDD6C6] mr-4">
              <li>معلومات الحساب (البريد الإلكتروني، رقم الهاتف، اسم المستخدم)</li>
              <li>بيانات شجرة العائلة (الأسماء، تواريخ الميلاد والوفاة، العلاقات الأسرية)</li>
              <li>سجلات الاستخدام والنشاط</li>
            </ul>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <Lock className="h-6 w-6 text-[#C29E58]" />
              <h2 className="text-xl font-medium text-[#F4EFE3]">كيف نحمي بياناتك</h2>
            </div>
            <p className="text-[#DDD6C6] leading-relaxed">
              نستخدم إجراءات أمنية متقدمة لحماية معلوماتك الشخصية:
            </p>
            <ul className="list-disc list-inside space-y-2 text-[#DDD6C6] mr-4">
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
              <Eye className="h-6 w-6 text-[#C29E58]" />
              <h2 className="text-xl font-medium text-[#F4EFE3]">كيف نستخدم بياناتك</h2>
            </div>
            <p className="text-[#DDD6C6] leading-relaxed">
              نستخدم المعلومات التي نجمعها للأغراض التالية:
            </p>
            <ul className="list-disc list-inside space-y-2 text-[#DDD6C6] mr-4">
              <li>توفير وعرض شجرة العائلة وتشغيلها</li>
              <li>التحقق من هويتك وتأمين حسابك</li>
              <li>تحسين تجربة المستخدم</li>
              <li>الامتثال للمتطلبات القانونية</li>
            </ul>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <UserCheck className="h-6 w-6 text-[#C29E58]" />
              <h2 className="text-xl font-medium text-[#F4EFE3]">حقوقك</h2>
            </div>
            <p className="text-[#DDD6C6] leading-relaxed">
              لديك الحقوق التالية فيما يتعلق ببياناتك الشخصية:
            </p>
            <ul className="list-disc list-inside space-y-2 text-[#DDD6C6] mr-4">
              <li><strong>التصحيح:</strong> يمكنك تعديل بياناتك من خلال الموقع</li>
              <li><strong>الحذف:</strong> يمكنك حذف حسابك وجميع بياناتك</li>
            </ul>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <Share2 className="h-6 w-6 text-[#C29E58]" />
              <h2 className="text-xl font-medium text-[#F4EFE3]">
                مشاركة البيانات مع أطراف ثالثة
              </h2>
            </div>
            <p className="text-[#DDD6C6] leading-relaxed">
              لا نبيع أو نؤجر بياناتك الشخصية لأي طرف ثالث. قد نشارك بياناتك فقط في الحالات التالية:
            </p>
            <ul className="list-disc list-inside space-y-2 text-[#DDD6C6] mr-4">
              <li>
                مع موفري الخدمات الذين يساعدوننا في تشغيل الموقع (رقم الهاتف أو
                البريد الإلكتروني للدخول للموقع)
              </li>
              <li>عندما يكون ذلك مطلوبًا بموجب القانون</li>
            </ul>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <Cookie className="h-6 w-6 text-[#C29E58]" />
              <h2 className="text-xl font-medium text-[#F4EFE3]">
                ملفات تعريف الارتباط
              </h2>
            </div>
            <p className="text-[#DDD6C6] leading-relaxed">
              نستخدم ملفات تعريف الارتباط الضرورية لتشغيل الموقع وتأمين جلسة المستخدم. 
              هذه الملفات ضرورية لعمل الموقع بشكل صحيح ولا يمكن تعطيلها.
            </p>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <Clock className="h-6 w-6 text-[#C29E58]" />
              <h2 className="text-xl font-medium text-[#F4EFE3]">
                الاحتفاظ بالبيانات
              </h2>
            </div>
            <p className="text-[#DDD6C6] leading-relaxed">
              نحتفظ ببياناتك طالما أن حسابك نشط. عند حذف حسابك، تُحذف جميع
              بياناتك الشخصية وبيانات شجرة العائلة وسجلات النشاط فوراً ولا يبقى
              منها شيء.
            </p>
          </section>

          <section className="space-y-4 bg-[#16233D] border border-[#F4EFE3]/10 rounded-[3px] p-6">
            <div className="flex items-center gap-3">
              <Mail className="h-6 w-6 text-[#C29E58]" />
              <h2 className="text-xl font-medium text-[#F4EFE3]">تواصل معنا</h2>
            </div>
            <p className="text-[#DDD6C6] leading-relaxed">
              إذا كانت لديك أي أسئلة حول سياسة الخصوصية هذه أو ممارسات البيانات لدينا، 
              يرجى التواصل معنا عبر:
            </p>
            <p className="text-[#C29E58] font-medium">
              support@uaeroots.com
            </p>
          </section>

          <div className="text-center pt-6 border-t border-[#F4EFE3]/12">
            <p className="text-sm text-[#9A9484]">
              جذور الإمارات - جميع الحقوق محفوظة © {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
