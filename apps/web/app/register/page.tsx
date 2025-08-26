'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardBody, Input, Button, Link } from '@heroui/react';
import { useAuth } from '@/lib/auth';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const ok = await register(name.trim(), email.trim(), password);
    setLoading(false);
    if (!ok) {
      setErr('Не удалось создать аккаунт');
      return;
    }
    router.push('/');
  };

  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardBody className="space-y-4">
          <h1 className="text-2xl font-semibold">Регистрация</h1>

          <form onSubmit={onSubmit} className="space-y-3">
            <Input label="Имя" value={name} onValueChange={setName} isRequired />
            <Input type="email" label="E-mail" value={email} onValueChange={setEmail} isRequired />
            <Input type="password" label="Пароль" value={password} onValueChange={setPass} isRequired />

            {err ? <p className="text-danger text-sm">{err}</p> : null}

            <Button color="primary" type="submit" isLoading={loading} className="w-full">
              Создать аккаунт
            </Button>
          </form>

          <p className="text-sm text-foreground-500">
            Уже есть аккаунт?{' '}
            <Link href="/login" color="primary">
              Войти
            </Link>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
