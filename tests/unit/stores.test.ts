/**
 * Store 模块单元测试
 * 测试 task/document/member/project store 的核心逻辑
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// Mock API 响应
// ============================================================
const mockApiResponse = <T>(data: T) => Promise.resolve({ data, error: undefined });
const mockApiError = (error: string) => Promise.resolve({ data: undefined, error });

// Mock data-service
vi.mock('@/lib/data-service', () => ({
  tasksApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  documentsApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  membersApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  projectsApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock zustand persist
vi.mock('zustand/middleware', () => ({
  persist: (fn: unknown) => fn,
}));

// ============================================================
// Task Store Tests
// ============================================================
describe('useTaskStore', () => {
  let useTaskStore: typeof import('@/domains/task').useTaskStore;
  let tasksApi: typeof import('@/lib/data-service').tasksApi;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    const dataService = await import('@/lib/data-service');
    tasksApi = dataService.tasksApi;
    
    const store = await import('@/domains/task');
    useTaskStore = store.useTaskStore;
    
    // Reset store
    useTaskStore.setState({ tasks: [], loading: false, error: null });
  });

  describe('本地操作', () => {
    const now = new Date();
    
    it('setTasks 应该更新任务列表', () => {
      const { setTasks } = useTaskStore.getState();
      setTasks([{ id: 't1', title: 'Task 1', status: 'todo', priority: 'medium', source: 'local', assignees: [], creatorId: 'test', createdAt: now, updatedAt: now }]);
      expect(useTaskStore.getState().tasks).toHaveLength(1);
    });

    it('addTask 应该追加任务', () => {
      const { setTasks, addTask } = useTaskStore.getState();
      setTasks([]);
      addTask({ id: 't1', title: 'New', status: 'todo', priority: 'medium', source: 'local', assignees: [], creatorId: 'test', createdAt: now, updatedAt: now });
      expect(useTaskStore.getState().tasks).toHaveLength(1);
    });

    it('updateTask 应该更新指定任务', () => {
      const { setTasks, updateTask } = useTaskStore.getState();
      setTasks([{ id: 't1', title: 'Old', status: 'todo', priority: 'medium', source: 'local', assignees: [], creatorId: 'test', createdAt: now, updatedAt: now }]);
      updateTask('t1', { title: 'New' });
      expect(useTaskStore.getState().tasks[0].title).toBe('New');
    });

    it('deleteTask 应该删除指定任务', () => {
      const { setTasks, deleteTask } = useTaskStore.getState();
      setTasks([
        { id: 't1', title: 'Task 1', status: 'todo', priority: 'medium', source: 'local', assignees: [], creatorId: 'test', createdAt: now, updatedAt: now },
        { id: 't2', title: 'Task 2', status: 'todo', priority: 'medium', source: 'local', assignees: [], creatorId: 'test', createdAt: now, updatedAt: now },
      ]);
      deleteTask('t1');
      expect(useTaskStore.getState().tasks).toHaveLength(1);
      expect(useTaskStore.getState().tasks[0].id).toBe('t2');
    });
  });

  describe('派生查询', () => {
    const now = new Date();
    
    it('getTasksByProject 应该返回项目任务', () => {
      const { setTasks, getTasksByProject } = useTaskStore.getState();
      setTasks([
        { id: 't1', projectId: 'p1', title: 'P1 Task', status: 'todo', priority: 'medium', source: 'local', assignees: [], creatorId: 'test', createdAt: now, updatedAt: now },
        { id: 't2', projectId: 'p2', title: 'P2 Task', status: 'todo', priority: 'medium', source: 'local', assignees: [], creatorId: 'test', createdAt: now, updatedAt: now },
      ]);
      const result = getTasksByProject('p1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('t1');
    });

    it('getTasksByMember 应该返回成员任务', () => {
      const { setTasks, getTasksByMember } = useTaskStore.getState();
      setTasks([
        { id: 't1', assignees: ['m1'], title: 'M1 Task', status: 'todo', priority: 'medium', source: 'local', creatorId: 'test', createdAt: now, updatedAt: now },
        { id: 't2', assignees: ['m2'], title: 'M2 Task', status: 'todo', priority: 'medium', source: 'local', creatorId: 'test', createdAt: now, updatedAt: now },
      ]);
      const result = getTasksByMember('m1');
      expect(result).toHaveLength(1);
    });

    it('getGlobalTasks 应该返回无项目任务', () => {
      const { setTasks, getGlobalTasks } = useTaskStore.getState();
      setTasks([
        { id: 't1', projectId: null, title: 'Global', status: 'todo', priority: 'medium', source: 'local', assignees: [], creatorId: 'test', createdAt: now, updatedAt: now },
        { id: 't2', projectId: 'p1', title: 'Project', status: 'todo', priority: 'medium', source: 'local', assignees: [], creatorId: 'test', createdAt: now, updatedAt: now },
      ]);
      const result = getGlobalTasks();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('t1');
    });

    it('getCrossProjectTasks 应该返回跨项目任务', () => {
      const { setTasks, getCrossProjectTasks } = useTaskStore.getState();
      setTasks([
        { id: 't1', crossProjects: ['p1', 'p2'], title: 'Cross', status: 'todo', priority: 'medium', source: 'local', assignees: [], creatorId: 'test', createdAt: now, updatedAt: now },
        { id: 't2', crossProjects: ['p3'], title: 'Other', status: 'todo', priority: 'medium', source: 'local', assignees: [], creatorId: 'test', createdAt: now, updatedAt: now },
      ]);
      const result = getCrossProjectTasks('p1');
      expect(result).toHaveLength(1);
    });
  });

  describe('异步操作', () => {
    const now = new Date();
    
    it('fetchTasks 成功应该更新 tasks', async () => {
      const mockTasks = [{ id: 't1', title: 'Task', status: 'todo', priority: 'medium', source: 'local', assignees: [], creatorId: 'test', createdAt: now, updatedAt: now }];
      (tasksApi.getAll as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockTasks, error: undefined });

      const { fetchTasks } = useTaskStore.getState();
      await fetchTasks();

      expect(useTaskStore.getState().tasks).toEqual(mockTasks);
      expect(useTaskStore.getState().loading).toBe(false);
    });

    it('fetchTasks 失败应该设置 error', async () => {
      (tasksApi.getAll as ReturnType<typeof vi.fn>).mockResolvedValue({ data: undefined, error: 'Network error' });

      const { fetchTasks } = useTaskStore.getState();
      await fetchTasks();

      expect(useTaskStore.getState().error).toBe('Network error');
    });

    it('createTask 成功应该添加任务', async () => {
      const newTask = { id: 't1', title: 'New', status: 'todo', priority: 'medium', source: 'local', assignees: [], creatorId: 'test', createdAt: now, updatedAt: now };
      (tasksApi.create as ReturnType<typeof vi.fn>).mockResolvedValue({ data: newTask, error: undefined });

      const { createTask } = useTaskStore.getState();
      const result = await createTask({ title: 'New', status: 'todo', priority: 'medium' });

      expect(result).toEqual(newTask);
      expect(useTaskStore.getState().tasks).toContainEqual(newTask);
    });

    it('updateTaskAsync 成功应该更新任务', async () => {
      const updated = { id: 't1', title: 'Updated', status: 'done', priority: 'medium', source: 'local', assignees: [], creatorId: 'test', createdAt: now, updatedAt: now };
      (tasksApi.update as ReturnType<typeof vi.fn>).mockResolvedValue({ data: updated, error: undefined });
      
      useTaskStore.setState({ tasks: [{ id: 't1', title: 'Old', status: 'todo', priority: 'medium', source: 'local', assignees: [], creatorId: 'test', createdAt: now, updatedAt: now }] });

      const { updateTaskAsync } = useTaskStore.getState();
      const result = await updateTaskAsync('t1', { status: 'done' });

      expect(result).toBe(true);
      expect(useTaskStore.getState().tasks[0].status).toBe('done');
    });

    it('deleteTaskAsync 成功应该删除任务', async () => {
      (tasksApi.delete as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { success: true }, error: undefined });
      useTaskStore.setState({ tasks: [{ id: 't1', title: 'Task', status: 'todo', priority: 'medium', source: 'local', assignees: [], creatorId: 'test', createdAt: now, updatedAt: now }] });

      const { deleteTaskAsync } = useTaskStore.getState();
      const result = await deleteTaskAsync('t1');

      expect(result).toBe(true);
      expect(useTaskStore.getState().tasks).toHaveLength(0);
    });
  });
});

// ============================================================
// Document Store Tests
// ============================================================
describe('useDocumentStore', () => {
  let useDocumentStore: typeof import('@/domains/document').useDocumentStore;
  let documentsApi: typeof import('@/lib/data-service').documentsApi;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    const dataService = await import('@/lib/data-service');
    documentsApi = dataService.documentsApi;
    
    const store = await import('@/domains/document');
    useDocumentStore = store.useDocumentStore;
    
    useDocumentStore.setState({ documents: [], loading: false, error: null });
  });

  describe('派生查询', () => {
    it('getDocumentsByProject 应该返回项目文档', () => {
      const { setDocuments, getDocumentsByProject } = useDocumentStore.getState();
      setDocuments([
        { id: 'd1', projectId: 'p1', title: 'Doc 1', content: '', createdAt: 0, updatedAt: 0 },
        { id: 'd2', projectId: 'p2', title: 'Doc 2', content: '', createdAt: 0, updatedAt: 0 },
      ]);
      const result = getDocumentsByProject('p1');
      expect(result).toHaveLength(1);
    });

    it('getDocumentsByProjectTag 应该返回标签文档', () => {
      const { setDocuments, getDocumentsByProjectTag } = useDocumentStore.getState();
      setDocuments([
        { id: 'd1', projectTags: ['project-alpha'], title: 'Doc 1', content: '', createdAt: 0, updatedAt: 0 },
        { id: 'd2', projectTags: ['project-beta'], title: 'Doc 2', content: '', createdAt: 0, updatedAt: 0 },
      ]);
      const result = getDocumentsByProjectTag('project-alpha');
      expect(result).toHaveLength(1);
    });

    it('getUntaggedDocuments 应该返回无标签文档', () => {
      const { setDocuments, getUntaggedDocuments } = useDocumentStore.getState();
      setDocuments([
        { id: 'd1', projectId: null, projectTags: [], title: 'Untagged', content: '', createdAt: 0, updatedAt: 0 },
        { id: 'd2', projectId: 'p1', title: 'Tagged', content: '', createdAt: 0, updatedAt: 0 },
      ]);
      const result = getUntaggedDocuments();
      expect(result).toHaveLength(1);
    });
  });

  describe('异步操作', () => {
    it('fetchDocuments 成功应该更新 documents', async () => {
      const mockDocs = [{ id: 'd1', title: 'Doc', content: '', createdAt: 0, updatedAt: 0 }];
      (documentsApi.getAll as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockDocs, error: undefined });

      const { fetchDocuments } = useDocumentStore.getState();
      await fetchDocuments();

      expect(useDocumentStore.getState().documents).toEqual(mockDocs);
    });
  });
});

// ============================================================
// Member Store Tests
// ============================================================
describe('useMemberStore', () => {
  let useMemberStore: typeof import('@/domains/member').useMemberStore;
  let membersApi: typeof import('@/lib/data-service').membersApi;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    const dataService = await import('@/lib/data-service');
    membersApi = dataService.membersApi;
    
    const store = await import('@/domains/member');
    useMemberStore = store.useMemberStore;
    
    useMemberStore.setState({ members: [], currentMemberId: null, loading: false, error: null });
  });

  describe('派生查询', () => {
    it('getHumanMembers 应该返回人类成员', () => {
      const { setMembers, getHumanMembers } = useMemberStore.getState();
      setMembers([
        { id: 'm1', name: 'Human', type: 'human', createdAt: 0, updatedAt: 0 },
        { id: 'm2', name: 'AI', type: 'ai', createdAt: 0, updatedAt: 0 },
      ]);
      const result = getHumanMembers();
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('human');
    });

    it('getAIMembers 应该返回 AI 成员', () => {
      const { setMembers, getAIMembers } = useMemberStore.getState();
      setMembers([
        { id: 'm1', name: 'Human', type: 'human', createdAt: 0, updatedAt: 0 },
        { id: 'm2', name: 'AI', type: 'ai', createdAt: 0, updatedAt: 0 },
      ]);
      const result = getAIMembers();
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('ai');
    });
  });

  describe('currentMemberId', () => {
    it('setCurrentMember 应该更新当前成员', () => {
      const { setCurrentMember } = useMemberStore.getState();
      setCurrentMember('m1');
      expect(useMemberStore.getState().currentMemberId).toBe('m1');
    });
  });
});

// ============================================================
// Project Store Tests
// ============================================================
describe('useProjectStore', () => {
  let useProjectStore: typeof import('@/domains/project').useProjectStore;
  let projectsApi: typeof import('@/lib/data-service').projectsApi;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    const dataService = await import('@/lib/data-service');
    projectsApi = dataService.projectsApi;
    
    const store = await import('@/domains/project');
    useProjectStore = store.useProjectStore;
    
    useProjectStore.setState({ projects: [], currentProjectId: null, loading: false, error: null, initialized: false });
  });

  describe('本地操作', () => {
    it('setProjects 应该设置 initialized', () => {
      const { setProjects } = useProjectStore.getState();
      setProjects([{ id: 'p1', name: 'Project', createdAt: 0, updatedAt: 0 }]);
      expect(useProjectStore.getState().initialized).toBe(true);
    });

    it('setCurrentProject 应该更新当前项目', () => {
      const { setCurrentProject } = useProjectStore.getState();
      setCurrentProject('p1');
      expect(useProjectStore.getState().currentProjectId).toBe('p1');
    });
  });

  describe('异步操作', () => {
    it('fetchProjects 成功应该更新 projects', async () => {
      const mockProjects = [{ id: 'p1', name: 'Project', createdAt: 0, updatedAt: 0 }];
      (projectsApi.getAll as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockProjects, error: undefined });

      const { fetchProjects } = useProjectStore.getState();
      await fetchProjects();

      expect(useProjectStore.getState().projects).toEqual(mockProjects);
      expect(useProjectStore.getState().initialized).toBe(true);
    });

    it('createProject 成功应该添加项目', async () => {
      const newProject = { id: 'p1', name: 'New Project', createdAt: 0, updatedAt: 0 };
      (projectsApi.create as ReturnType<typeof vi.fn>).mockResolvedValue({ data: newProject, error: undefined });

      const { createProject } = useProjectStore.getState();
      const result = await createProject({ name: 'New Project' });

      expect(result).toEqual(newProject);
      expect(useProjectStore.getState().projects).toContainEqual(newProject);
    });

    it('deleteProjectAsync 成功应该删除项目', async () => {
      (projectsApi.delete as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { success: true }, error: undefined });
      useProjectStore.setState({ projects: [{ id: 'p1', name: 'Project', createdAt: 0, updatedAt: 0 }] });

      const { deleteProjectAsync } = useProjectStore.getState();
      const result = await deleteProjectAsync('p1');

      expect(result).toBe(true);
      expect(useProjectStore.getState().projects).toHaveLength(0);
    });
  });
});
