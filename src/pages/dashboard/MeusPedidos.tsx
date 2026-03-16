import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { getFullApiUrl } from '@/utils/apiHelper';
import { pdfRgService, PdfRgPedido, PdfRgStatus } from '@/services/pdfRgService';
import { editarPdfService, EditarPdfPedido } from '@/services/pdfPersonalizadoService';
import { sistemasDominioComService } from '@/services/sistemasDominioComService';
import { Eye, Download, Loader2, Package, DollarSign, Hammer, CheckCircle, ClipboardList, FileDown, FileText, Ban, Globe } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardTitleCard from '@/components/dashboard/DashboardTitleCard';
import { useNavigate } from 'react-router-dom';
import { useLocale, type Locale } from '@/contexts/LocaleContext';

type ActivePedidoStatus = Exclude<PdfRgStatus, 'cancelado'>;
const STATUS_ORDER: ActivePedidoStatus[] = ['realizado', 'pagamento_confirmado', 'em_confeccao', 'entregue'];

const localeCode: Record<Locale, string> = {
  'pt-BR': 'pt-BR',
  en: 'en-US',
  es: 'es-ES',
};

const textByLocale: Record<Locale, any> = {
  'pt-BR': {
    pageTitle: 'Meus Pedidos',
    status: {
      realizado: 'Pedido Realizado',
      pagamento_confirmado: 'Pagamento Confirmado',
      em_confeccao: 'Em Confecção',
      entregue: 'Entregue',
      cancelado: 'Cancelado',
    },
    canceledAudit: 'Pedido cancelado e mantido no histórico para auditoria.',
    loadOrdersError: 'Erro ao carregar pedidos',
    loadDetailsError: 'Erro ao carregar detalhes',
    pdfUnavailable: 'PDF ainda não disponível',
    typeRg: 'PDF de RG',
    typeCustom: 'PDF Personalizado',
    typeDomain: 'Domínio .COM',
    domain: 'Domínio',
    confirmCancel: 'Tem certeza que deseja cancelar este pedido?',
    canceledSuccess: 'Pedido cancelado com sucesso',
    cancelError: 'Erro ao cancelar pedido',
    noOrders: 'Você ainda não possui pedidos.',
    placeOrder: 'Fazer um Pedido',
    order: 'Pedido',
    value: 'Valor',
    date: 'Data',
    details: 'Detalhes',
    canceling: 'Cancelando...',
    cancelOrder: 'Cancelar pedido',
    downloadPdf: 'Baixar PDF',
    orderDetails: 'Detalhes do pedido',
    name: 'Nome',
    birth: 'Nascimento',
    birthplace: 'Naturalidade',
    mother: 'Mãe',
    father: 'Pai',
    director: 'Diretor',
    requester: 'Solicitante',
    changes: 'Descrição das alterações',
    attachments: 'Anexos',
    deliveredPdf: 'PDF Entregue',
    pdfDownload: 'Download PDF',
  },
  en: {
    pageTitle: 'My Orders',
    status: {
      realizado: 'Order Placed',
      pagamento_confirmado: 'Payment Confirmed',
      em_confeccao: 'In Production',
      entregue: 'Delivered',
      cancelado: 'Canceled',
    },
    canceledAudit: 'Order canceled and kept in history for audit purposes.',
    loadOrdersError: 'Error loading orders',
    loadDetailsError: 'Error loading details',
    pdfUnavailable: 'PDF not available yet',
    typeRg: 'ID PDF',
    typeCustom: 'Custom PDF',
    typeDomain: 'Domain .COM',
    domain: 'Domain',
    confirmCancel: 'Are you sure you want to cancel this order?',
    canceledSuccess: 'Order canceled successfully',
    cancelError: 'Error canceling order',
    noOrders: 'You do not have any orders yet.',
    placeOrder: 'Place an Order',
    order: 'Order',
    value: 'Amount',
    date: 'Date',
    details: 'Details',
    canceling: 'Canceling...',
    cancelOrder: 'Cancel order',
    downloadPdf: 'Download PDF',
    orderDetails: 'Order details',
    name: 'Name',
    birth: 'Birth date',
    birthplace: 'Birthplace',
    mother: 'Mother',
    father: 'Father',
    director: 'Director',
    requester: 'Requester',
    changes: 'Change description',
    attachments: 'Attachments',
    deliveredPdf: 'Delivered PDF',
    pdfDownload: 'Download PDF',
  },
  es: {
    pageTitle: 'Mis Pedidos',
    status: {
      realizado: 'Pedido Realizado',
      pagamento_confirmado: 'Pago Confirmado',
      em_confeccao: 'En Producción',
      entregue: 'Entregado',
      cancelado: 'Cancelado',
    },
    canceledAudit: 'Pedido cancelado y mantenido en el historial para auditoría.',
    loadOrdersError: 'Error al cargar pedidos',
    loadDetailsError: 'Error al cargar detalles',
    pdfUnavailable: 'PDF aún no disponible',
    typeRg: 'PDF RG',
    typeCustom: 'PDF Personalizado',
    typeDomain: 'Dominio .COM',
    domain: 'Dominio',
    confirmCancel: '¿Seguro que deseas cancelar este pedido?',
    canceledSuccess: 'Pedido cancelado con éxito',
    cancelError: 'Error al cancelar pedido',
    noOrders: 'Aún no tienes pedidos.',
    placeOrder: 'Hacer un pedido',
    order: 'Pedido',
    value: 'Valor',
    date: 'Fecha',
    details: 'Detalles',
    canceling: 'Cancelando...',
    cancelOrder: 'Cancelar pedido',
    downloadPdf: 'Descargar PDF',
    orderDetails: 'Detalles del pedido',
    name: 'Nombre',
    birth: 'Nacimiento',
    birthplace: 'Lugar de nacimiento',
    mother: 'Madre',
    father: 'Padre',
    director: 'Director',
    requester: 'Solicitante',
    changes: 'Descripción de cambios',
    attachments: 'Adjuntos',
    deliveredPdf: 'PDF Entregado',
    pdfDownload: 'Descargar PDF',
  },
};

const statusIcons: Record<PdfRgStatus, React.ReactNode> = {
  realizado: <Package className="h-5 w-5" />,
  pagamento_confirmado: <DollarSign className="h-5 w-5" />,
  em_confeccao: <Hammer className="h-5 w-5" />,
  entregue: <CheckCircle className="h-5 w-5" />,
  cancelado: <Ban className="h-5 w-5" />,
};

const statusBadgeColors: Record<PdfRgStatus, string> = {
  realizado: 'bg-emerald-500 text-white',
  pagamento_confirmado: 'bg-emerald-500 text-white',
  em_confeccao: 'bg-blue-500 text-white',
  entregue: 'bg-emerald-500 text-white',
  cancelado: 'bg-destructive text-destructive-foreground',
};

const getStatusIndex = (status: PdfRgStatus) => status === 'cancelado' ? -1 : STATUS_ORDER.indexOf(status);

type UnifiedPedido = {
  type: 'pdf-rg' | 'pdf-personalizado' | 'dominio-com';
  id: number;
  status: PdfRgStatus;
  preco_pago: number | string;
  created_at: string;
  realizado_at: string | null;
  pagamento_confirmado_at: string | null;
  em_confeccao_at: string | null;
  entregue_at: string | null;
  pdf_entrega_base64?: string | null;
  pdf_entrega_nome?: string | null;
  anexo1_nome?: string | null;
  anexo2_nome?: string | null;
  anexo3_nome?: string | null;
  cpf?: string;
  nome?: string;
  dt_nascimento?: string;
  naturalidade?: string;
  filiacao_mae?: string;
  filiacao_pai?: string;
  diretor?: string;
  qr_plan?: string;
  nome_solicitante?: string;
  descricao_alteracoes?: string;
  dominio_completo?: string;
};

const MeusPedidos = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { locale } = useLocale();
  const t = textByLocale[locale];

  const formatDateBR = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  const formatFullDate = (dateString: string | null) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString(localeCode[locale], {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString(localeCode[locale], {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  };

  const [pedidos, setPedidos] = useState<UnifiedPedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPedido, setSelectedPedido] = useState<UnifiedPedido | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [cancelingPedidoKey, setCancelingPedidoKey] = useState<string | null>(null);

  const getStepTimestamp = (pedido: UnifiedPedido, step: ActivePedidoStatus): string | null => {
    const map: Record<PdfRgStatus, string | null> = {
      realizado: pedido.realizado_at,
      pagamento_confirmado: pedido.pagamento_confirmado_at,
      em_confeccao: pedido.em_confeccao_at,
      entregue: pedido.entregue_at,
      cancelado: null,
    };
    return map[step];
  };

  const StatusTracker = ({ pedido }: { pedido: UnifiedPedido }) => {
    if (pedido.status === 'cancelado') {
      return (
        <div className="w-full py-4 px-4">
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-foreground flex items-center gap-2">
            <Ban className="h-4 w-4 text-destructive" />
            {t.canceledAudit}
          </div>
        </div>
      );
    }

    const currentIdx = getStatusIndex(pedido.status);

    return (
      <div className="w-full py-6 px-2">
        <div className="flex items-center justify-between relative">
          <div className="absolute top-5 left-[12%] right-[12%] h-1 bg-muted rounded-full" />
          <div
            className="absolute top-5 left-[12%] h-1 rounded-full transition-all duration-700 ease-out bg-emerald-500"
            style={{ width: `${Math.max(0, (currentIdx / 3) * 76)}%` }}
          />

          {STATUS_ORDER.map((step, idx) => {
            const isCompleted = idx < currentIdx;
            const isCurrent = idx === currentIdx;
            const isActive = idx <= currentIdx;
            const isEmConfeccao = step === 'em_confeccao' && isCurrent;
            const timestamp = getStepTimestamp(pedido, step);

            return (
              <div key={step} className="flex flex-col items-center z-10 flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${
                    isCompleted || (isCurrent && step === 'entregue')
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                      : isEmConfeccao
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30 animate-pulse'
                      : isCurrent
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                      : 'bg-muted text-muted-foreground'
                  } ${isCurrent ? 'ring-4 ring-emerald-500/20 scale-110' : ''}`}
                >
                  {isCompleted ? <CheckCircle className="h-5 w-5" /> : statusIcons[step]}
                </div>
                <span className={`text-[10px] sm:text-xs mt-2 text-center leading-tight max-w-[80px] ${
                  isActive ? (isEmConfeccao ? 'text-blue-600 font-semibold' : 'text-emerald-600 font-semibold') : 'text-muted-foreground'
                }`}>
                  {t.status[step]}
                </span>
                {timestamp && isActive && (
                  <span className="text-[9px] text-muted-foreground mt-0.5">
                    {formatTime(timestamp)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const loadPedidos = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [resRg, resPersonalizado, resDominio] = await Promise.all([
        pdfRgService.listar({ limit: 50, user_id: Number(user.id) }),
        editarPdfService.listar({ limit: 50, user_id: Number(user.id) }),
        sistemasDominioComService.listMine({ limit: 50, offset: 0 }),
      ]);

      const allPedidos: UnifiedPedido[] = [];

      if (resRg.success && resRg.data?.data) {
        resRg.data.data.forEach((p: PdfRgPedido) => {
          allPedidos.push({
            type: 'pdf-rg',
            id: p.id,
            status: p.status,
            preco_pago: p.preco_pago,
            created_at: p.created_at,
            realizado_at: p.realizado_at,
            pagamento_confirmado_at: p.pagamento_confirmado_at,
            em_confeccao_at: p.em_confeccao_at,
            entregue_at: p.entregue_at,
            pdf_entrega_base64: p.pdf_entrega_base64,
            pdf_entrega_nome: p.pdf_entrega_nome,
            anexo1_nome: p.anexo1_nome,
            anexo2_nome: p.anexo2_nome,
            anexo3_nome: p.anexo3_nome,
            cpf: p.cpf,
            nome: p.nome,
            dt_nascimento: p.dt_nascimento,
            naturalidade: p.naturalidade,
            filiacao_mae: p.filiacao_mae,
            filiacao_pai: p.filiacao_pai,
            diretor: p.diretor,
            qr_plan: p.qr_plan,
          });
        });
      }

      if (resPersonalizado.success && resPersonalizado.data?.data) {
        resPersonalizado.data.data.forEach((p: EditarPdfPedido) => {
          allPedidos.push({
            type: 'pdf-personalizado',
            id: p.id,
            status: p.status,
            preco_pago: p.preco_pago,
            created_at: p.created_at,
            realizado_at: p.realizado_at,
            pagamento_confirmado_at: p.pagamento_confirmado_at,
            em_confeccao_at: p.em_confeccao_at,
            entregue_at: p.entregue_at,
            pdf_entrega_base64: p.pdf_entrega_base64,
            pdf_entrega_nome: p.pdf_entrega_nome,
            anexo1_nome: p.anexo1_nome,
            anexo2_nome: p.anexo2_nome,
            anexo3_nome: p.anexo3_nome,
            nome_solicitante: p.nome_solicitante,
            descricao_alteracoes: p.descricao_alteracoes,
          });
        });
      }

      if (resDominio.success && resDominio.data?.data) {
        resDominio.data.data.forEach((p) => {
          const isCanceled = p.status === 'cancelado';
          allPedidos.push({
            type: 'dominio-com',
            id: p.id,
            status: isCanceled ? 'cancelado' : 'realizado',
            preco_pago: p.valor_cobrado,
            created_at: p.created_at,
            realizado_at: p.created_at,
            pagamento_confirmado_at: null,
            em_confeccao_at: null,
            entregue_at: null,
            nome_solicitante: p.nome_solicitante,
            dominio_completo: p.dominio_completo,
          });
        });
      }

      allPedidos.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setPedidos(allPedidos);
    } catch {
      toast.error(t.loadOrdersError);
    } finally {
      setLoading(false);
    }
  }, [user?.id, t.loadOrdersError]);

  useEffect(() => {
    loadPedidos();
  }, [loadPedidos]);

  const handleView = async (pedido: UnifiedPedido) => {
    try {
      if (pedido.type === 'pdf-rg') {
        const res = await pdfRgService.obter(pedido.id);
        if (res.success && res.data) {
          const p = res.data;
          setSelectedPedido({ ...pedido, ...p });
          setShowModal(true);
        }
      } else if (pedido.type === 'pdf-personalizado') {
        const res = await editarPdfService.obter(pedido.id);
        if (res.success && res.data) {
          const p = res.data;
          setSelectedPedido({ ...pedido, ...p });
          setShowModal(true);
        }
      } else {
        const res = await sistemasDominioComService.getById(pedido.id);
        if (res.success && res.data) {
          const p = res.data;
          setSelectedPedido({
            ...pedido,
            nome_solicitante: p.nome_solicitante,
            dominio_completo: p.dominio_completo,
            preco_pago: p.valor_cobrado,
            status: p.status === 'cancelado' ? 'cancelado' : 'realizado',
            created_at: p.created_at,
            realizado_at: p.created_at,
          });
          setShowModal(true);
        }
      }
    } catch {
      toast.error(t.loadDetailsError);
    }
  };

  const handleDownload = (pedido: UnifiedPedido) => {
    if (!pedido.pdf_entrega_nome && !pedido.pdf_entrega_base64) {
      toast.error(t.pdfUnavailable);
      return;
    }

    if (pedido.pdf_entrega_base64) {
      try {
        let base64Data = pedido.pdf_entrega_base64;
        let mimeType = 'application/pdf';

        if (base64Data.includes(',')) {
          const parts = base64Data.split(',');
          const header = parts[0];
          base64Data = parts[1];
          const mimeMatch = header.match(/data:([^;]+)/);
          if (mimeMatch) mimeType = mimeMatch[1];
        }

        const byteChars = atob(base64Data);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNumbers[i] = byteChars.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = pedido.pdf_entrega_nome || 'entrega.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      } catch (e) {
        console.error('Erro ao criar download do base64:', e);
      }
    }

    if (pedido.pdf_entrega_nome) {
      const downloadUrl = getFullApiUrl(`/upload/delivery?file=${encodeURIComponent(pedido.pdf_entrega_nome)}`);
      window.open(downloadUrl, '_blank');
    }
  };

  const getTypeLabel = (type: string) => (
    type === 'pdf-rg'
      ? t.typeRg
      : type === 'pdf-personalizado'
      ? t.typeCustom
      : t.typeDomain
  );
  const canCancelPedido = (status: PdfRgStatus) => ['realizado', 'pagamento_confirmado'].includes(status);

  const handleCancelPedido = async (pedido: UnifiedPedido) => {
    if (!canCancelPedido(pedido.status) || pedido.type === 'dominio-com') return;
    const pedidoKey = `${pedido.type}-${pedido.id}`;
    if (!confirm(t.confirmCancel)) return;

    setCancelingPedidoKey(pedidoKey);
    try {
      const res = pedido.type === 'pdf-rg'
        ? await pdfRgService.deletar(pedido.id)
        : await editarPdfService.deletar(pedido.id);

      if (res.success) {
        toast.success(t.canceledSuccess);
        setPedidos((prev) => prev.map((item) => (
          item.type === pedido.type && item.id === pedido.id
            ? { ...item, status: 'cancelado' as PdfRgStatus }
            : item
        )));
        if (selectedPedido && selectedPedido.type === pedido.type && selectedPedido.id === pedido.id) {
          setSelectedPedido({ ...selectedPedido, status: 'cancelado' as PdfRgStatus });
        }
      } else {
        toast.error(res.error || t.cancelError);
      }
    } catch {
      toast.error(t.cancelError);
    } finally {
      setCancelingPedidoKey(null);
    }
  };

  const getTypeBadgeClass = (type: string) => type === 'pdf-rg'
    ? 'bg-violet-500/10 text-violet-600 border-violet-500/20'
    : type === 'pdf-personalizado'
    ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
    : 'bg-sky-500/10 text-sky-600 border-sky-500/20';

  return (
    <div className="space-y-4 md:space-y-6 max-w-5xl mx-auto">
      <DashboardTitleCard title={t.pageTitle} icon={<ClipboardList className="h-4 w-4 sm:h-5 sm:w-5" />} />

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : pedidos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <ClipboardList className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">{t.noOrders}</p>
            <Button onClick={() => navigate('/dashboard/pdf-rg')}>{t.placeOrder}</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pedidos.map((p) => (
            <Card key={`${p.type}-${p.id}`} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center justify-between p-4 border-b bg-muted/30">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-sm">{t.order} #{p.id}</span>
                    <Badge variant="outline" className={getTypeBadgeClass(p.type)}>
                      {p.type === 'dominio-com' ? <Globe className="h-3 w-3 mr-1" /> : <FileText className="h-3 w-3 mr-1" />}
                      {getTypeLabel(p.type)}
                    </Badge>
                    <Badge className={statusBadgeColors[p.status] || 'bg-muted'}>
                      {t.status[p.status] || p.status}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatFullDate(p.created_at)}</span>
                </div>

                <StatusTracker pedido={p} />

                <div className="px-4 pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="text-sm text-muted-foreground grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-1">
                    {p.type === 'pdf-rg' ? (
                      <>
                        {p.cpf && <p>CPF: <span className="font-mono text-foreground">{p.cpf}</span></p>}
                        {p.nome && <p>{t.name}: <span className="text-foreground">{p.nome}</span></p>}
                        <p>{t.value}: <span className="text-foreground font-medium">R$ {Number(p.preco_pago || 0).toFixed(2)}</span></p>
                        {p.dt_nascimento && <p className="hidden md:block">{t.birth}: <span className="text-foreground">{formatDateBR(p.dt_nascimento)}</span></p>}
                      </>
                    ) : p.type === 'pdf-personalizado' ? (
                      <>
                        {p.nome_solicitante && <p>{t.requester}: <span className="text-foreground">{p.nome_solicitante}</span></p>}
                        <p>{t.value}: <span className="text-foreground font-medium">R$ {Number(p.preco_pago || 0).toFixed(2)}</span></p>
                        {p.descricao_alteracoes && <p className="md:col-span-2 truncate max-w-md">{t.changes}: <span className="text-foreground">{p.descricao_alteracoes}</span></p>}
                      </>
                    ) : (
                      <>
                        {p.nome_solicitante && <p>{t.requester}: <span className="text-foreground">{p.nome_solicitante}</span></p>}
                        {p.dominio_completo && <p>{t.domain}: <span className="text-foreground font-mono">{p.dominio_completo}</span></p>}
                        <p>{t.value}: <span className="text-foreground font-medium">R$ {Number(p.preco_pago || 0).toFixed(2)}</span></p>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => handleView(p)}>
                      <Eye className="h-4 w-4 mr-1" /> {t.details}
                    </Button>
                    {canCancelPedido(p.status) && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleCancelPedido(p)}
                        disabled={cancelingPedidoKey === `${p.type}-${p.id}`}
                        className="gap-1"
                      >
                        {cancelingPedidoKey === `${p.type}-${p.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                        {cancelingPedidoKey === `${p.type}-${p.id}` ? t.canceling : t.cancelOrder}
                      </Button>
                    )}
                    {p.status === 'entregue' && p.pdf_entrega_nome && (
                      <Button size="icon" className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 w-8" onClick={() => handleDownload(p)} title={t.downloadPdf}>
                        <FileDown className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.order} #{selectedPedido?.id}</DialogTitle>
            <DialogDescription>{selectedPedido ? getTypeLabel(selectedPedido.type) : t.orderDetails}</DialogDescription>
          </DialogHeader>
          {selectedPedido && (
            <div className="space-y-4 text-sm">
              <StatusTracker pedido={selectedPedido} />

              <div className="grid grid-cols-2 gap-2">
                {selectedPedido.type === 'pdf-rg' ? (
                  <>
                    {selectedPedido.cpf && <><span className="text-muted-foreground">CPF:</span><span className="font-mono">{selectedPedido.cpf}</span></>}
                    {selectedPedido.nome && <><span className="text-muted-foreground">{t.name}:</span><span>{selectedPedido.nome}</span></>}
                    {selectedPedido.dt_nascimento && <><span className="text-muted-foreground">{t.birth}:</span><span>{formatDateBR(selectedPedido.dt_nascimento)}</span></>}
                    {selectedPedido.naturalidade && <><span className="text-muted-foreground">{t.birthplace}:</span><span>{selectedPedido.naturalidade}</span></>}
                    {selectedPedido.filiacao_mae && <><span className="text-muted-foreground">{t.mother}:</span><span>{selectedPedido.filiacao_mae}</span></>}
                    {selectedPedido.filiacao_pai && <><span className="text-muted-foreground">{t.father}:</span><span>{selectedPedido.filiacao_pai}</span></>}
                    {selectedPedido.diretor && <><span className="text-muted-foreground">{t.director}:</span><span>{selectedPedido.diretor}</span></>}
                    {selectedPedido.qr_plan && <><span className="text-muted-foreground">QR Code:</span><span>{selectedPedido.qr_plan.toUpperCase()}</span></>}
                  </>
                ) : (
                  <>
                    {selectedPedido.nome_solicitante && <><span className="text-muted-foreground">{t.requester}:</span><span>{selectedPedido.nome_solicitante}</span></>}
                    {selectedPedido.descricao_alteracoes && (
                      <>
                        <span className="text-muted-foreground col-span-2">{t.changes}:</span>
                        <span className="col-span-2 whitespace-pre-wrap text-foreground bg-muted/50 rounded p-2">{selectedPedido.descricao_alteracoes}</span>
                      </>
                    )}
                  </>
                )}
                <span className="text-muted-foreground">{t.value}:</span><span>R$ {Number(selectedPedido.preco_pago || 0).toFixed(2)}</span>
                <span className="text-muted-foreground">{t.date}:</span><span>{formatFullDate(selectedPedido.created_at)}</span>
              </div>

              {(selectedPedido.anexo1_nome || selectedPedido.anexo2_nome || selectedPedido.anexo3_nome) && (
                <div>
                  <p className="text-muted-foreground mb-1">{t.attachments}:</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { nome: selectedPedido.anexo1_nome, label: 'Anexo 1' },
                      { nome: selectedPedido.anexo2_nome, label: 'Anexo 2' },
                      { nome: selectedPedido.anexo3_nome, label: 'Anexo 3' },
                    ].filter(a => a.nome).map((a, i) => {
                      const downloadUrl = getFullApiUrl(`/upload/serve?file=${encodeURIComponent(a.nome!)}`);
                      return (
                        <Badge key={i} variant="secondary" className="text-xs cursor-pointer hover:bg-secondary/80">
                          <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                            <Download className="h-3 w-3" /> {a.label}
                          </a>
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedPedido.status === 'entregue' && (selectedPedido.pdf_entrega_nome || selectedPedido.pdf_entrega_base64) && (
                <div className="border-t pt-3">
                  <p className="text-muted-foreground mb-2">📄 {t.deliveredPdf}:</p>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleDownload(selectedPedido)}>
                    <Download className="h-4 w-4 mr-2" /> {selectedPedido.pdf_entrega_nome || t.pdfDownload}
                  </Button>
                </div>
              )}

              {canCancelPedido(selectedPedido.status) && (
                <div className="border-t pt-3">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleCancelPedido(selectedPedido)}
                    disabled={cancelingPedidoKey === `${selectedPedido.type}-${selectedPedido.id}`}
                    className="gap-1"
                  >
                    {cancelingPedidoKey === `${selectedPedido.type}-${selectedPedido.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                    {cancelingPedidoKey === `${selectedPedido.type}-${selectedPedido.id}` ? t.canceling : t.cancelOrder}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MeusPedidos;
