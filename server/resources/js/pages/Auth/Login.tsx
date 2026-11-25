import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, LockKeyhole, ScanFace, ShieldCheck, Video, User } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

const HIGHLIGHTS = [
    { icon: Video, title: 'Theo dõi phòng thi trực tiếp', text: 'Quan sát camera và màn hình thí sinh ngay trong một trang.' },
    { icon: ScanFace, title: 'Xác minh danh tính thí sinh', text: 'Đối chiếu khuôn mặt với ảnh đã đăng ký trước kỳ thi.' },
    { icon: ShieldCheck, title: 'Biên bản và bằng chứng đầy đủ', text: 'Mọi sự việc đều có thời gian, hình ảnh và video để xem lại.' },
];

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        router.post(
            '/login',
            { username, password },
            {
                onError: (errors) => setError(errors.username || errors.password || 'Đăng nhập không thành công. Vui lòng thử lại.'),
                onFinish: () => setIsLoading(false),
            },
        );
    };

    return (
        <div className="grid min-h-screen bg-background text-foreground lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <Head title="Đăng nhập | FoxyExam" />

            {/* Brand panel (large screens) */}
            <aside className="relative hidden overflow-hidden bg-[#0e0f12] text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
                <div className="pointer-events-none absolute -left-32 -top-32 size-[28rem] rounded-full bg-orange-500/25 blur-[120px]" />
                <div className="pointer-events-none absolute -bottom-40 right-[-8rem] size-[30rem] rounded-full bg-amber-500/15 blur-[140px]" />
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.07]"
                    style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '44px 44px' }}
                />

                <Link href="/" className="relative flex items-center gap-3">
                    <img src="/mark.png" alt="" className="size-10 rounded-lg" />
                    <span className="text-lg font-bold tracking-tight">
                        FOXY<span className="text-orange-400">EXAM</span>
                    </span>
                </Link>

                <div className="relative space-y-8">
                    <div className="space-y-3">
                        <h2 className="max-w-md text-3xl font-bold leading-tight tracking-tight">Tổ chức thi trực tuyến nghiêm túc, minh bạch và dễ quản lý.</h2>
                        <p className="max-w-md text-sm leading-relaxed text-white/60">Dành cho giảng viên và cán bộ nhà trường: từ chuẩn bị đề, theo dõi giờ thi đến lập biên bản sau kỳ thi.</p>
                    </div>

                    <ul className="max-w-md space-y-4">
                        {HIGHLIGHTS.map((h) => (
                            <li key={h.title} className="flex items-start gap-3">
                                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/8 text-orange-300 ring-1 ring-white/10">
                                    <h.icon className="size-4" />
                                </span>
                                <span>
                                    <span className="block text-sm font-semibold">{h.title}</span>
                                    <span className="block text-[13px] leading-relaxed text-white/55">{h.text}</span>
                                </span>
                            </li>
                        ))}
                    </ul>

                    {/* Placeholder product screenshot; swap the file in /public/images/mockups to change it */}
                    <div className="relative max-w-xl">
                        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5 shadow-2xl shadow-black/50 ring-1 ring-white/5">
                            <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2">
                                <span className="size-2 rounded-full bg-white/20" />
                                <span className="size-2 rounded-full bg-white/20" />
                                <span className="size-2 rounded-full bg-white/20" />
                            </div>
                            <img src="/images/mockups/operator-view.png" alt="Màn hình theo dõi giờ thi" className="block w-full" loading="lazy" />
                        </div>
                    </div>
                </div>

                <p className="relative text-xs text-white/40">© {new Date().getFullYear()} FoxyExam. Hệ thống thi trực tuyến có giám sát.</p>
            </aside>

            {/* Form */}
            <main className="relative flex flex-col items-center justify-center px-6 py-12">
                <div className="absolute right-4 top-4">
                    <ThemeToggle />
                </div>

                <div className="w-full max-w-sm space-y-8">
                    <div className="space-y-4">
                        <Link href="/" className="flex items-center gap-2.5 lg:hidden">
                            <img src="/mark.png" alt="" className="size-9 rounded-lg" />
                            <span className="text-base font-bold tracking-tight">
                                FOXY<span className="text-primary">EXAM</span>
                            </span>
                        </Link>
                        <div className="space-y-1.5">
                            <h1 className="text-2xl font-bold tracking-tight">Đăng nhập</h1>
                            <p className="text-sm text-muted-foreground">Cổng quản trị dành cho giảng viên và nhà trường.</p>
                        </div>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-5" noValidate>
                        {error && (
                            <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-[13px] text-destructive">
                                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label htmlFor="username" className="text-[13px] font-medium">
                                Tên đăng nhập hoặc email
                            </label>
                            <div className="relative">
                                <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    id="username"
                                    type="text"
                                    autoComplete="username"
                                    autoFocus
                                    required
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="h-11 w-full rounded-lg border border-border bg-background pl-10 pr-3 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/15"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label htmlFor="password" className="text-[13px] font-medium">
                                Mật khẩu
                            </label>
                            <div className="relative">
                                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="h-11 w-full rounded-lg border border-border bg-background pl-10 pr-11 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/15"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((v) => !v)}
                                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                    className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                                >
                                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || !username || !password}
                            className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="size-4 animate-spin" /> Đang đăng nhập…
                                </>
                            ) : (
                                <>
                                    Đăng nhập <ArrowRight className="size-4" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="space-y-3 border-t border-border pt-6 text-[13px] text-muted-foreground">
                        <p>Quên mật khẩu hoặc chưa có tài khoản? Vui lòng liên hệ quản trị viên của đơn vị bạn.</p>
                        <p>
                            Là thí sinh?{' '}
                            <Link href="/download" className="font-medium text-primary hover:underline">
                                Tải ứng dụng làm bài thi
                            </Link>
                            .
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
