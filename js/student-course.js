import Alpine from './alpine-core.js';
import { getCurrentSession, isDemoMode } from './session.js';
import { fetchCourseById } from './courses.js';
import { isStudentEnrolledInCourse } from './students.js';
import {
  formatDueDate,
  formatSessionDateTime,
  fetchStudentCourseWorkspace,
  submitActivityLink,
  fetchAttendanceForCourse,
  buildCourseStatistics,
  formatPercent,
  formatScore,
  attendanceStatusMeta,
} from './classroom.js';

function courseIdFromUrl() {
  return new URLSearchParams(window.location.search).get('id');
}

document.addEventListener('alpine:init', () => {
  Alpine.data('studentCourse', () => ({
    courseId: null,
    course: null,
    activities: [],
    sessions: [],
    submissions: [],
    grades: [],
    allAttendance: [],
    session: null,
    tab: 'actividades',
    loading: true,
    saving: false,
    savingActivityId: null,
    error: '',
    success: '',
    linkDrafts: {},

    get studentUserId() {
      return this.session?.user?.id ?? (isDemoMode() ? 'demo' : null);
    },

    get myStats() {
      const uid = this.studentUserId;
      if (!uid) return null;
      const students = [
        {
          id: uid,
          full_name: this.session?.name || 'Estudiante',
          student_id: this.session?.studentId,
        },
      ];
      const built = buildCourseStatistics(
        students,
        this.sessions,
        this.activities,
        this.grades,
        this.allAttendance,
        this.submissions,
      );
      return {
        attendance: built.attendanceByStudent[0],
        grades: built.gradesByStudent[0],
        summary: built.summary,
      };
    },

    get myAttendanceRows() {
      const studentId = this.studentUserId;
      if (!studentId) return [];

      const bySession = new Map(
        this.allAttendance
          .filter((r) => r.student_id === studentId)
          .map((r) => [r.session_id, r]),
      );

      return [...this.sessions]
        .sort((a, b) => {
          const da = `${a.session_date}T${a.start_time}`;
          const db = `${b.session_date}T${b.start_time}`;
          return db.localeCompare(da);
        })
        .map((session) => {
          const record = bySession.get(session.id);
          const meta = attendanceStatusMeta(record?.status);
          return { session, record, meta };
        });
    },

    get attendanceRowsWithRecord() {
      return this.myAttendanceRows.filter((row) => row.record);
    },

    get upcomingSessions() {
      const today = new Date().toISOString().slice(0, 10);
      return [...this.sessions]
        .filter((s) => s.session_date >= today)
        .sort((a, b) => `${a.session_date}${a.start_time}`.localeCompare(`${b.session_date}${b.start_time}`))
        .slice(0, 5);
    },

    get onlineActivities() {
      return this.activities.filter((a) => a.allow_online_submit);
    },

    async initStudentCourse() {
      this.courseId = courseIdFromUrl();
      if (!this.courseId) {
        window.location.replace('estudiante.html');
        return;
      }

      const tabParam = new URLSearchParams(window.location.search).get('tab');
      if (tabParam && ['actividades', 'asistencia', 'horario'].includes(tabParam)) {
        this.tab = tabParam;
      }

      this.session = await getCurrentSession();
      const studentId = this.session?.user?.id;

      if (isDemoMode()) {
        this.course = { id: this.courseId, title: 'Entendiendo a Dios (demo)' };
        this.activities = [
          {
            id: 'a1',
            title: 'Ensayo teológico',
            description: 'Sube tu documento en Drive y pega el enlace.',
            due_at: new Date(Date.now() + 86400000 * 7).toISOString(),
            allow_online_submit: true,
          },
          {
            id: 'a2',
            title: 'Lectura cap. 3',
            description: 'Solo lectura en clase.',
            due_at: null,
            allow_online_submit: false,
          },
        ];
        this.sessions = [
          {
            id: 's1',
            session_date: new Date().toISOString().slice(0, 10),
            start_time: '19:00:00',
          },
        ];
        this.allAttendance = [
          { session_id: 's1', student_id: 'demo', status: 'present' },
        ];
        this.grades = [{ activity_id: 'a2', score: 88 }];
        this.linkDrafts = { a1: '' };
        this.loading = false;
        return;
      }

      if (!studentId) {
        window.location.replace('index.html');
        return;
      }

      try {
        const enrolled = await isStudentEnrolledInCourse(this.courseId, studentId);
        if (!enrolled) {
          this.error = 'No estás matriculado en este curso.';
          this.loading = false;
          return;
        }

        this.course = await fetchCourseById(this.courseId);
        const [data, allAttendance] = await Promise.all([
          fetchStudentCourseWorkspace(this.courseId, studentId),
          fetchAttendanceForCourse(this.courseId),
        ]);
        this.activities = data.activities;
        this.sessions = data.sessions;
        this.submissions = data.submissions;
        this.grades = data.grades;
        this.allAttendance = allAttendance;
        this.syncLinkDrafts();
      } catch (err) {
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    },

    syncLinkDrafts() {
      const drafts = {};
      for (const a of this.activities) {
        const sub = this.submissions.find((s) => s.activity_id === a.id);
        drafts[a.id] = sub?.submission_url || '';
      }
      this.linkDrafts = drafts;
    },

    gradeFor(activityId) {
      const g = this.grades.find((row) => row.activity_id === activityId);
      return g?.score ?? null;
    },

    submissionFor(activityId) {
      return this.submissions.find((s) => s.activity_id === activityId);
    },

    attendanceForSession(sessionId) {
      return this.myAttendanceRows.find((r) => r.session.id === sessionId) ?? null;
    },

    isOverdue(activity) {
      if (!activity.due_at) return false;
      return new Date(activity.due_at) < new Date() && !this.submissionFor(activity.id);
    },

    activityStatus(activity) {
      const grade = this.gradeFor(activity.id);
      if (grade !== null) {
        return { key: 'graded', label: `Calificada: ${formatScore(grade)}/100`, tone: 'primary' };
      }
      if (activity.allow_online_submit) {
        if (this.submissionFor(activity.id)) {
          return { key: 'submitted', label: 'Entregada', tone: 'success' };
        }
        if (this.isOverdue(activity)) {
          return { key: 'overdue', label: 'Vencida — pendiente', tone: 'danger' };
        }
        return { key: 'pending', label: 'Pendiente de entrega', tone: 'warn' };
      }
      return { key: 'info', label: 'En clase / sin entrega en línea', tone: 'neutral' };
    },

    statusBadgeClass(tone) {
      const map = {
        primary: 'bg-primary-container text-on-primary-container',
        success: 'bg-tertiary-fixed text-tertiary-container',
        danger: 'bg-error-container text-on-error-container',
        warn: 'bg-secondary-fixed text-on-secondary-fixed',
        neutral: 'bg-surface-container-high text-on-surface-variant',
      };
      return map[tone] || map.neutral;
    },

    attendanceBadgeClass(tone) {
      const map = {
        success: 'bg-tertiary-fixed text-tertiary-container',
        warn: 'bg-secondary-fixed text-on-secondary-fixed',
        danger: 'bg-error-container text-on-error-container',
        neutral: 'bg-surface-container-high text-on-surface-variant',
      };
      return map[tone] || map.neutral;
    },

    async saveLink(activityId) {
      this.error = '';
      this.success = '';
      this.saving = true;
      this.savingActivityId = activityId;
      try {
        await submitActivityLink(activityId, this.linkDrafts[activityId] || '');
        const studentId = this.session.user.id;
        const data = await fetchStudentCourseWorkspace(this.courseId, studentId);
        this.submissions = data.submissions;
        this.syncLinkDrafts();
        this.success = 'Tu enlace de entrega se guardó correctamente.';
      } catch (err) {
        this.error = err.message;
      } finally {
        this.saving = false;
        this.savingActivityId = null;
      }
    },

    formatDueDate,
    formatSessionDateTime,
    formatPercent,
    formatScore,
  }));
});
