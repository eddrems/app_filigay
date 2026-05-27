import Alpine from './alpine-core.js';
import { getCurrentSession, isDemoMode } from './session.js';
import { fetchMyEnrollments } from './students.js';
import { formatPrice } from './courses.js';
import {
  fetchActiveCourses,
  fetchMyEnrollmentRequests,
  submitEnrollmentRequest,
  requestStatusLabel,
} from './enrollment-requests.js';
import {
  fetchStudentCourseWorkspace,
  fetchAttendanceForCourse,
  buildCourseStatistics,
  formatPercent,
  formatScore,
  formatSessionDateTime,
  formatDueDate,
  formatShortDate,
  getStudentActivityStatus,
} from './classroom.js';

async function loadCourseSnapshots(studentId, enrollments) {
  const snapshots = await Promise.all(
    enrollments.map(async (enrollment) => {
      const courseId = enrollment.course_id;
      const course = enrollment.course;
      if (!courseId || !course) return null;

      const [workspace, attendance] = await Promise.all([
        fetchStudentCourseWorkspace(courseId, studentId),
        fetchAttendanceForCourse(courseId),
      ]);

      const stats = buildCourseStatistics(
        [{ id: studentId, full_name: '', student_id: '' }],
        workspace.sessions,
        workspace.activities,
        workspace.grades,
        attendance,
        workspace.submissions,
      );

      return {
        enrollment,
        course,
        ...workspace,
        attendance,
        attendanceStat: stats.attendanceByStudent[0],
        gradeStat: stats.gradesByStudent[0],
      };
    }),
  );

  return snapshots.filter(Boolean);
}

function buildActivityFeed(snapshots) {
  const feed = [];
  for (const snap of snapshots) {
    for (const act of snap.activities) {
      const gradeRow = snap.grades.find((g) => g.activity_id === act.id);
      const sub = snap.submissions.find((s) => s.activity_id === act.id);
      const status = getStudentActivityStatus(act, gradeRow?.score ?? null, !!sub);
      feed.push({
        id: act.id,
        courseId: snap.course.id,
        courseTitle: snap.course.title,
        title: act.title,
        due_at: act.due_at,
        allow_online_submit: act.allow_online_submit,
        status,
        score: gradeRow?.score ?? null,
      });
    }
  }

  return feed.sort((a, b) => {
    if (!a.due_at && !b.due_at) return a.title.localeCompare(b.title);
    if (!a.due_at) return 1;
    if (!b.due_at) return -1;
    return new Date(a.due_at) - new Date(b.due_at);
  });
}

function findNextSession(snapshots) {
  const today = new Date().toISOString().slice(0, 10);
  let best = null;

  for (const snap of snapshots) {
    for (const s of snap.sessions) {
      if (s.session_date < today) continue;
      const key = `${s.session_date}T${s.start_time}`;
      if (!best || key < `${best.session.session_date}T${best.session.start_time}`) {
        best = { session: s, course: snap.course };
      }
    }
  }
  return best;
}

function buildSummary(snapshots, activityFeed) {
  const gradeAvgs = snapshots
    .map((s) => s.gradeStat?.average)
    .filter((a) => a !== null && a !== undefined);
  const attendRates = snapshots
    .map((s) => s.attendanceStat?.rate)
    .filter((r) => r !== null && r !== undefined);

  const pending = activityFeed.filter(
    (a) => a.status.key === 'pending' || a.status.key === 'overdue',
  ).length;

  const graded = activityFeed.filter((a) => a.status.key === 'graded').length;
  const total = activityFeed.length;
  const progressPct = total > 0 ? Math.round((graded / total) * 100) : 0;

  const totalTuition = snapshots.reduce((sum, s) => sum + Number(s.course?.price || 0), 0);

  return {
    courseCount: snapshots.length,
    overallGradeAvg:
      gradeAvgs.length > 0 ? gradeAvgs.reduce((a, b) => a + b, 0) / gradeAvgs.length : null,
    overallAttendanceAvg:
      attendRates.length > 0 ? attendRates.reduce((a, b) => a + b, 0) / attendRates.length : null,
    pendingActivities: pending,
    progressPct,
    totalTuition,
  };
}

document.addEventListener('alpine:init', () => {
  Alpine.data('studentPortal', () => ({
    session: null,
    enrollments: [],
    courseSnapshots: [],
    activityFeed: [],
    nextSession: null,
    summary: null,
    loadingCourses: true,
    loadingDashboard: true,
    loadingExplore: false,
    portalTab: 'inicio',
    allCourses: [],
    myRequests: [],
    requestMessageByCourse: {},
    submittingCourseId: null,
    requestSuccess: '',
    error: '',

    get enrolledCourseIds() {
      return new Set(this.enrollments.map((e) => e.course_id));
    },

    get requestByCourseId() {
      const map = {};
      for (const r of this.myRequests) {
        if (!map[r.course_id] || new Date(r.created_at) > new Date(map[r.course_id].created_at)) {
          map[r.course_id] = r;
        }
      }
      return map;
    },

    get catalogCourses() {
      return this.allCourses.filter((c) => !this.enrolledCourseIds.has(c.id));
    },

    get pendingRequestCount() {
      return this.myRequests.filter((r) => r.status === 'pending').length;
    },

    get displayName() {
      return this.session?.name?.split(' ')[0] || 'Estudiante';
    },

    get initials() {
      return (this.session?.name || 'AZ')
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
    },

    get primaryCourse() {
      return this.enrollments[0]?.course ?? null;
    },

    get primaryCourseUrl() {
      const id = this.primaryCourse?.id;
      return id ? `estudiante-curso.html?id=${encodeURIComponent(id)}` : '#';
    },

    courseUrlWithTab(courseId, tab) {
      return `estudiante-curso.html?id=${encodeURIComponent(courseId)}&tab=${tab}`;
    },

    get recentActivities() {
      return this.activityFeed.slice(0, 8);
    },

    get pendingActivities() {
      return this.activityFeed.filter(
        (a) => a.status.key === 'pending' || a.status.key === 'overdue',
      );
    },

    statusBadgeClass(key) {
      const map = {
        success: 'zao-badge-success',
        pending: 'zao-badge-pending',
        danger: 'zao-badge-pending',
        neutral: 'rounded-full bg-surface-container-high px-2 py-0.5 text-label-sm text-on-surface-variant',
      };
      if (key === 'danger') return 'rounded-full bg-error-container px-2 py-0.5 text-label-sm font-semibold text-on-error-container';
      return map[key] || map.neutral;
    },

    courseUrl(courseId) {
      return `estudiante-curso.html?id=${encodeURIComponent(courseId)}`;
    },

    courseCardState(courseId) {
      if (this.enrolledCourseIds.has(courseId)) {
        return { key: 'enrolled', label: 'Matriculado', canRequest: false };
      }
      const req = this.requestByCourseId[courseId];
      if (!req) return { key: 'available', label: 'Disponible', canRequest: true };
      const meta = requestStatusLabel(req.status);
      return {
        key: req.status,
        label: meta.label,
        canRequest: req.status === 'rejected',
        request: req,
      };
    },

    requestBadgeClass(tone) {
      const map = {
        success: 'zao-badge-success',
        pending: 'zao-badge-pending',
        danger: 'rounded-full bg-error-container px-2 py-0.5 text-label-sm font-semibold text-on-error-container',
      };
      return map[tone] || 'rounded-full bg-surface-container-high px-2 py-0.5 text-label-sm';
    },

    async loadExploreData() {
      const studentId = this.session?.user?.id;
      if (!studentId || isDemoMode()) return;

      this.loadingExplore = true;
      try {
        const [courses, requests] = await Promise.all([
          fetchActiveCourses(),
          fetchMyEnrollmentRequests(studentId),
        ]);
        this.allCourses = courses;
        this.myRequests = requests;
      } catch (err) {
        this.error = err.message;
      } finally {
        this.loadingExplore = false;
      }
    },

    async submitEnrollmentRequest(course) {
      this.error = '';
      this.requestSuccess = '';
      this.submittingCourseId = course.id;
      try {
        if (isDemoMode()) {
          throw new Error('Ejecuta supabase/08-enrollment-requests.sql en Supabase.');
        }
        await submitEnrollmentRequest(course.id, this.requestMessageByCourse[course.id] || '');
        this.requestMessageByCourse[course.id] = '';
        this.requestSuccess = `Solicitud enviada para «${course.title}». Un administrador la revisará pronto.`;
        await this.loadExploreData();
      } catch (err) {
        this.error = err.message;
      } finally {
        this.submittingCourseId = null;
      }
    },

    async initStudentPortal() {
      this.session = await getCurrentSession();

      if (isDemoMode()) {
        this.enrollments = [
          {
            id: 'e1',
            course_id: 'c1',
            course: {
              id: 'c1',
              title: 'Entendiendo a Dios',
              price: 149.99,
              cover_image_url: null,
            },
          },
        ];
        this.activityFeed = [
          {
            id: 'a1',
            courseId: 'c1',
            courseTitle: 'Entendiendo a Dios',
            title: 'Ensayo: Atributos divinos',
            due_at: new Date().toISOString(),
            status: getStudentActivityStatus({ allow_online_submit: true, due_at: null }, 95, true),
            score: 95,
          },
          {
            id: 'a2',
            courseId: 'c1',
            courseTitle: 'Entendiendo a Dios',
            title: 'Foro: La Trinidad',
            due_at: new Date(Date.now() + 86400000 * 5).toISOString(),
            status: getStudentActivityStatus({ allow_online_submit: true, due_at: new Date(Date.now() + 86400000 * 5).toISOString() }, null, false),
            score: null,
          },
        ];
        this.summary = {
          courseCount: 1,
          overallGradeAvg: 91.5,
          overallAttendanceAvg: 92,
          pendingActivities: 1,
          progressPct: 50,
          totalTuition: 149.99,
        };
        this.nextSession = {
          session: { session_date: new Date().toISOString().slice(0, 10), start_time: '19:00:00' },
          course: { title: 'Entendiendo a Dios', id: 'c1' },
        };
        this.allCourses = [
          {
            id: 'c2',
            title: 'Liderazgo espiritual',
            price: 199.99,
            cover_image_url: null,
            teacher: { full_name: 'Prof. Carlos Mendoza' },
          },
        ];
        this.myRequests = [];
        this.loadingCourses = false;
        this.loadingDashboard = false;
        return;
      }

      const studentId = this.session?.user?.id;
      if (!studentId) {
        this.loadingCourses = false;
        this.loadingDashboard = false;
        return;
      }

      try {
        this.enrollments = await fetchMyEnrollments(studentId);
        this.loadingCourses = false;

        if (!this.enrollments.length) {
          this.loadingDashboard = false;
          return;
        }

        this.courseSnapshots = await loadCourseSnapshots(studentId, this.enrollments);
        this.activityFeed = buildActivityFeed(this.courseSnapshots);
        this.nextSession = findNextSession(this.courseSnapshots);
        this.summary = buildSummary(this.courseSnapshots, this.activityFeed);
        await this.loadExploreData();
      } catch (err) {
        this.error = err.message;
      } finally {
        this.loadingDashboard = false;
      }
    },

    teacherName(course) {
      return course?.teacher?.full_name || 'Por asignar';
    },

    courseTitleById(courseId) {
      const c = this.allCourses.find((x) => x.id === courseId);
      if (c) return c.title;
      const e = this.enrollments.find((x) => x.course_id === courseId);
      return e?.course?.title || 'Curso';
    },

    badgeForCourseState(courseId) {
      const state = this.courseCardState(courseId);
      if (state.key === 'enrolled') {
        return { label: state.label, class: 'zao-badge-success' };
      }
      if (state.key === 'available') {
        return { label: 'Disponible', class: 'rounded-full bg-surface-container-high px-2 py-0.5 text-label-sm' };
      }
      const meta = requestStatusLabel(state.key);
      return { label: meta.label, class: this.requestBadgeClass(meta.tone) };
    },

    formatPrice,
    formatPercent,
    formatScore,
    formatSessionDateTime,
    formatDueDate,
    formatShortDate,
  }));
});
