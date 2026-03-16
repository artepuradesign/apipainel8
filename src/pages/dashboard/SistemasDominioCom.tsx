import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, CheckCircle2, Globe, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useApiModules } from '@/hooks/useApiModules';
import { useUserSubscription } from '@/hooks/useUserSubscription';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { getModulePrice } from '@/utils/modulePrice';
import { sistemasDominioComService, type SistemaDominioComRegistro } from '@/services/sistemasDominioComService';
import SimpleTitleBar from '@/components/dashboard/SimpleTitleBar';

const MODULE_ID = 176;
const MODULE_ROUTE = '/dashboard/sistemas-dominio-com';

const SistemasDominioCom = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { modules } = useApiModules();
  const { balance, loadBalance: reloadBalance } = useWalletBalance();
  const {
    hasActiveSubscription,
    discountPercentage,
    calculateDiscountedPrice: calculateSubscriptionDiscount,
  } = useUserSubscription();

  const [nomeSolicitante, setNomeSolicitante] = useState('');
  const [dominioNome, setDominioNome] = useState('');
  const [checkLoading, setCheckLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [availability, setAvailability] = useState<{ dominioCompleto: string; disponivel: boolean; message: string } | null>(null);
  const [registros, setRegistros] = useState<SistemaDominioComRegistro[]>([]);
  const [registrosLoading, setRegistrosLoading] = useState(false);

  const normalizeModuleRoute = useCallback((module: any): string => {
    const raw = (module?.api_endpoint || module?.path || '').toString().trim();
    if (!raw) return '';
    if (raw.startsWith('/')) return raw;
    if (raw.startsWith('dashboard/')) return `/${raw}`;
    if (!raw.includes('/')) return `/dashboard/${raw}`;
    return raw;
  }, []);

  const currentModule = useMemo(() => {
    const pathname = (location?.pathname || '').trim();
    if (!pathname) return null;
    return (modules || []).find((m: any) => normalizeModuleRoute(m) === pathname) || null;
  }, [modules, location?.pathname, normalizeModuleRoute]);

  const modulePrice = useMemo(() => {
    const configuredPrice = Number(currentModule?.price ?? 0);
    if (configuredPrice > 0) return configuredPrice;
    return getModulePrice(MODULE_ROUTE);
  }, [currentModule?.price]);

  const { discountedPrice: finalPrice } = hasActiveSubscription && modulePrice > 0
    ? calculateSubscriptionDiscount(modulePrice)
    : { discountedPrice: modulePrice };

  const totalBalance = (balance.saldo || 0) + (balance.saldo_plano || 0);
  const canRegister = Boolean(
    user &&
    nomeSolicitante.trim() &&
    availability?.disponivel &&
    finalPrice > 0 &&
    totalBalance >= finalPrice
  );

  const loadRegistros = useCallback(async () => {
    if (!user?.id) return;
    try {
      setRegistrosLoading(true);
      const result = await sistemasDominioComService.listMine({ limit: 50, offset: 0 });
      if (result.success && result.data) {
        setRegistros(result.data.data || []);
      } else {
        setRegistros([]);
      }
    } catch {
      setRegistros([]);
    } finally {
      setRegistrosLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    reloadBalance();
    loadRegistros();
  }, [user, reloadBalance, loadRegistros]);

  const handleCheck = async () => {
    if (!nomeSolicitante.trim()) {
      toast.error('Informe o nome do solicitante');
      return;
    }

    const cleanedDomain = dominioNome.trim().toLowerCase().replace(/\.com$/, '');
    if (!cleanedDomain) {
      toast.error('Informe um nome para o domínio .com');
      return;
    }

    setCheckLoading(true);
    try {
      const result = await sistemasDominioComService.checkAvailability(cleanedDomain);
      if (!result.success || !result.data) {
        toast.error(result.error || 'Erro ao verificar domínio');
        setAvailability(null);
        return;
      }

      const isAvailable = Boolean(result.data.disponivel);
      setAvailability({
        dominioCompleto: result.data.dominio_completo,
        disponivel: isAvailable,
        message: isAvailable ? 'Domínio disponível para registro.' : 'Domínio já registrado.',
      });

      if (isAvailable) toast.success('Domínio disponível!');
      else toast.error('Domínio indisponível.');
    } catch {
      toast.error('Erro ao consultar domínio');
      setAvailability(null);
    } finally {
      setCheckLoading(false);
    }
  };

  const openConfirmModal = () => {
    if (!canRegister) {
      if (totalBalance < finalPrice) {
        toast.error(`Saldo insuficiente. Necessário: R$ ${finalPrice.toFixed(2).replace('.', ',')}`);
        return;
      }
      toast.error('Preencha os dados e pesquise um domínio disponível');
      return;
    }

    setShowConfirmModal(true);
  };

  const handleRegister = async () => {
    if (!availability?.disponivel) return;

    setSubmitLoading(true);
    try {
      const result = await sistemasDominioComService.register({
        nome_solicitante: nomeSolicitante.trim(),
        dominio_nome: availability.dominioCompleto.replace(/\.com$/, ''),
        module_id: currentModule?.id || MODULE_ID,
      });

      if (!result.success || !result.data) {
        toast.error(result.error || 'Erro ao registrar domínio');
        return;
      }

      toast.success(`Domínio ${result.data.dominio_completo} registrado com sucesso!`);
      setShowConfirmModal(false);
      setDominioNome('');
      setAvailability(null);
      await Promise.all([reloadBalance(), loadRegistros()]);
    } catch {
      toast.error('Erro ao registrar domínio');
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="space-y-3 px-1 sm:px-0">
      <SimpleTitleBar
        title="DOMÍNIO .COM"
        subtitle="Verifique disponibilidade e registre domínio .com"
        onBack={() => navigate('/dashboard')}
        icon={<Globe className="h-5 w-5" />}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Novo registro de domínio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-1.5">
            <Label htmlFor="nomeSolicitante">Nome do solicitante</Label>
            <Input
              id="nomeSolicitante"
              placeholder="Ex.: João Silva"
              value={nomeSolicitante}
              onChange={(e) => setNomeSolicitante(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="dominioNome">Nome do domínio (.com)</Label>
            <div className="flex gap-2">
              <div className="flex items-center flex-1 rounded-md border border-input bg-background px-3">
                <Input
                  id="dominioNome"
                  className="border-0 px-0 focus-visible:ring-0"
                  placeholder="meudominio"
                  value={dominioNome}
                  onChange={(e) => setDominioNome(e.target.value.toLowerCase())}
                />
                <span className="text-sm text-muted-foreground">.com</span>
              </div>
              <Button type="button" onClick={handleCheck} disabled={checkLoading}>
                {checkLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Pesquisar
              </Button>
            </div>
          </div>

          {availability && (
            <div className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {availability.disponivel ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span className="text-sm font-medium">{availability.dominioCompleto}</span>
                </div>
                <Badge variant={availability.disponivel ? 'secondary' : 'destructive'}>
                  {availability.disponivel ? 'Disponível' : 'Indisponível'}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{availability.message}</p>
            </div>
          )}

          <div className="rounded-md border border-border p-3 text-sm space-y-1">
            <p>Valor do módulo: <strong>R$ {modulePrice.toFixed(2).replace('.', ',')}</strong></p>
            {hasActiveSubscription && (
              <p>Desconto do plano: <strong>{discountPercentage}%</strong></p>
            )}
            <p>Valor final estimado: <strong>R$ {finalPrice.toFixed(2).replace('.', ',')}</strong></p>
            <p>Saldo disponível: <strong>R$ {totalBalance.toFixed(2).replace('.', ',')}</strong></p>
          </div>

          <Button type="button" onClick={openConfirmModal} disabled={!canRegister} className="w-full">
            Registrar domínio
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Meus registros</CardTitle>
        </CardHeader>
        <CardContent>
          {registrosLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando registros...
            </div>
          ) : registros.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum domínio registrado ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domínio</TableHead>
                    <TableHead>Solicitante</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registros.map((registro) => (
                    <TableRow key={registro.id}>
                      <TableCell className="font-medium">{registro.dominio_completo}</TableCell>
                      <TableCell>{registro.nome_solicitante}</TableCell>
                      <TableCell>R$ {Number(registro.valor_cobrado).toFixed(2).replace('.', ',')}</TableCell>
                      <TableCell>
                        <Badge variant={registro.status === 'registrado' ? 'secondary' : 'outline'}>
                          {registro.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(registro.created_at).toLocaleDateString('pt-BR')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar registro de domínio</DialogTitle>
            <DialogDescription>
              Você está prestes a registrar o domínio <strong>{availability?.dominioCompleto}</strong> para <strong>{nomeSolicitante}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-border p-3 text-sm space-y-1">
            <p>Valor a cobrar: <strong>R$ {finalPrice.toFixed(2).replace('.', ',')}</strong></p>
            <p>O saldo será descontado automaticamente após confirmar.</p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmModal(false)} disabled={submitLoading}>
              Cancelar
            </Button>
            <Button onClick={handleRegister} disabled={submitLoading}>
              {submitLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Confirmar e registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SistemasDominioCom;
