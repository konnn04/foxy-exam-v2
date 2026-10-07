import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Code2, ArrowRight, AlertCircle, ShieldCheck } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

export default function Login() {
    const [username, setUsername] = useState('admin');
    const [password, setPassword] = useState('admin123');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        router.post('/login', {
            username,
            password,
        }, {
            onError: (errors) => {
                setError(errors.username || errors.password || 'Đăng nhập thất bại.');
                setIsLoading(false);
            },
            onFinish: () => setIsLoading(false),
        });
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 font-sans relative">
            <Head title="Đăng nhập Cổng Quản Trị | FoxyExam" />

            {/* Top Right Theme Toggle */}
            <div className="absolute top-4 right-4">
                <ThemeToggle />
            </div>

            <div className="w-full max-w-md space-y-6">
                <div className="text-center space-y-2">
                    <div className="inline-flex w-12 h-12 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-600 items-center justify-center shadow-lg shadow-orange-500/25">
                        <Code2 className="w-6 h-6 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        FOXY<span className="text-primary">EXAM</span>
                    </h1>
                    <p className="text-xs text-muted-foreground">Cổng Quản trị dành cho Giảng viên & Nhà trường</p>
                </div>

                <Card className="border-border bg-card shadow-2xl">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-base font-semibold">Đăng nhập tài khoản</CardTitle>
                        <CardDescription className="text-xs">
                            Quản lý đề thi, khóa học, hạn mức gói cước và theo dõi giám thị trực tiếp.
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        <form onSubmit={handleLogin} className="space-y-4">
                            {error && (
                                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-foreground">Tên Đăng Nhập / Email</label>
                                <Input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="admin hoặc teacher_hcmus"
                                    required
                                    className="h-10 text-xs"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-foreground">Mật Khẩu</label>
                                <Input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className="h-10 text-xs"
                                />
                            </div>

                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-2 mt-2 text-xs shadow-md shadow-primary/20"
                            >
                                {isLoading ? 'Đang đăng nhập...' : 'Đăng Nhập'}
                                <ArrowRight className="w-4 h-4" />
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <div className="p-3 rounded-lg bg-card/60 border border-border text-xs text-muted-foreground space-y-1">
                    <span className="font-semibold text-foreground block">Tài khoản demo sẵn có:</span>
                    <p>• Super Admin: <code className="text-primary font-mono font-semibold">admin</code> / <code className="text-primary font-mono">admin123</code></p>
                    <p>• Quản trị trường: <code className="text-primary font-mono font-semibold">admin_hcmus</code> / <code className="text-primary font-mono">admin123</code></p>
                    <p>• Giảng viên trường: <code className="text-primary font-mono font-semibold">teacher_hcmus</code> / <code className="text-primary font-mono">teacher123</code></p>
                </div>
            </div>
        </div>
    );
}
