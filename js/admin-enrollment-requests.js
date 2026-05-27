import Alpine from './alpine-core.js';
import { isDemoMode } from './session.js';
import {
  fetchEnrollmentRequestsForAdmin,
  reviewEnrollmentRequest,
  requestStatusLabel,
} from './enrollment-requests.js';
import { formatPrice } from './courses.js';

document.addEventListener('alpine:init', () => {
  Alpine.data('enrollmentRequestsManager', () => ({
    requests: [],
    filter: 'pending',
    loading: true,
    processingId: null,
    error: '',
    success: '',
    demoMode: isDemoMode(),
    notesById: {},

    get pendingCount() {
      return this.requests.filter((r) => r.status === 'pending').length;
    },

    async initRequests() {
      if (this.demoMode) {
        this.requests = [
          {
            id: 'r1',
            status: 'pending',
            message: 'Quiero unirme al curso de otoño.',
            created_at: new Date().toISOString(),
            student: { full_name: 'Alejandro Martínez', email: 'estudiante@zao.edu', student_id: 'ZAO-2023-459' },
            course: { title: 'Entendiendo a Dios', price: 149.99 },
          },
        ];
        this.loading = false;
        return;
      }
      await this.reload();
    },

    async reload() {
      this.loading = true;
      this.error = '';
      try {
        this.requests = await fetchEnrollmentRequestsForAdmin(this.filter);
      } catch (err) {
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    },

    async approve(request) {
      await this.review(request, true);
    },

    async reject(request) {
      await this.review(request, false);
    },

    async review(request, approve) {
      this.error = '';
      this.success = '';
      this.processingId = request.id;
      try {
        if (this.demoMode) {
          throw new Error('Ejecuta supabase/08-enrollment-requests.sql en Supabase.');
        }
        await reviewEnrollmentRequest(request.id, approve, this.notesById[request.id] || '');
        this.success = approve
          ? `Matrícula aprobada: ${request.student?.full_name} → ${request.course?.title}`
          : `Solicitud rechazada.`;
        this.notesById[request.id] = '';
        await this.reload();
      } catch (err) {
        this.error = err.message;
      } finally {
        this.processingId = null;
      }
    },

    statusMeta(status) {
      return requestStatusLabel(status);
    },

    statusBadgeClass(tone) {
      const map = {
        success: 'zao-badge-success',
        pending: 'zao-badge-pending',
        danger: 'rounded-full bg-error-container px-2 py-0.5 text-label-sm font-semibold text-on-error-container',
        neutral: 'rounded-full bg-surface-container-high px-2 py-0.5 text-label-sm',
      };
      return map[tone] || map.neutral;
    },

    formatPrice,
    formatDate(iso) {
      if (!iso) return '—';
      return new Date(iso).toLocaleString('es-ES', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    },
  }));
});
