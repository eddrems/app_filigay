export const ROLES = {
  admin: 'admin',
  teacher: 'teacher',
  student: 'student',
};

export const ROLE_ROUTES = {
  [ROLES.admin]: 'admin.html',
  [ROLES.teacher]: 'docente.html',
  [ROLES.student]: 'estudiante.html',
};

export const DEMO_USERS = {
  'admin@zao.edu': {
    password: 'admin123',
    role: ROLES.admin,
    name: 'Administrador ZAO',
    phone: 'admin123',
  },
  'maestro@zao.edu': {
    password: 'prof123',
    role: ROLES.teacher,
    name: 'Prof. Carlos Mendoza',
    phone: 'prof123',
  },
  'estudiante@zao.edu': {
    password: 'alum123',
    role: ROLES.student,
    name: 'Alejandro Martínez',
    phone: 'alum123',
    studentId: 'ZAO-2023-459',
  },
};

export function resolveRole(email, metadata = {}) {
  const fromMeta = metadata?.role;
  if (fromMeta && ROLE_ROUTES[fromMeta]) return fromMeta;
  const demo = DEMO_USERS[email?.toLowerCase()];
  if (demo) return demo.role;
  if (email?.includes('admin')) return ROLES.admin;
  if (email?.includes('maestro') || email?.includes('prof')) return ROLES.teacher;
  return ROLES.student;
}

export function routeForRole(role) {
  return ROLE_ROUTES[role] || 'estudiante.html';
}
