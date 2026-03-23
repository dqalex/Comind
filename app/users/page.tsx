'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/domains';
import AppShell from '@/shared/layout/AppShell';
import Header from '@/shared/layout/Header';
import { Button, Input, Badge, Dialog } from '@/shared/ui';
import { useRouter } from 'next/navigation';
import { 
  Users, Plus, Search, Trash2, Edit, Shield, 
  User, Eye, KeyRound, Mail, Calendar,
} from 'lucide-react';
import clsx from 'clsx';

// 用户角色配置
const ROLE_CONFIG = {
  admin: { label: '管理员', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  member: { label: '成员', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  viewer: { label: '只读', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700/30 dark:text-gray-400' },
};

type UserRole = keyof typeof ROLE_CONFIG;

interface UserItem {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
  role: UserRole;
  emailVerified: boolean;
  lastLoginAt?: Date | null;
  createdAt: Date;
}

interface PaginatedResponse {
  data: UserItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function UsersPage() {
  const router = useRouter();
  // 精确 selector 订阅
  const currentUser = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const fetchCurrentUser = useAuthStore((s) => s.fetchCurrentUser);
  
  // 权限检查
  useEffect(() => {
    if (!isAuthLoading && isAuthenticated && currentUser?.role !== 'admin') {
      router.push('/');
    }
  }, [isAuthLoading, isAuthenticated, currentUser, router]);

  // 状态
  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  
  // 对话框状态
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  
  // 表单状态
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: '',
    role: 'member' as UserRole,
  });

  // 初始化：检查认证状态
  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  // 获取用户列表
  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '20');
      if (searchQuery) params.set('search', searchQuery);
      if (roleFilter) params.set('role', roleFilter);
      
      const response = await fetch(`/api/users?${params}`);
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '获取用户列表失败');
      }
      
      const result: PaginatedResponse = await response.json();
      setUsers(result.data);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络请求失败');
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery, roleFilter]);

  // 监听筛选条件变化
  useEffect(() => {
    if (isAuthenticated && currentUser?.role === 'admin') {
      fetchUsers();
    }
  }, [isAuthenticated, currentUser?.role, fetchUsers]);

  // 创建用户
  const handleCreate = async () => {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '创建用户失败');
      }
      
      setShowCreateDialog(false);
      setFormData({ email: '', name: '', password: '', role: 'member' });
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    }
  };

  // 更新用户
  const handleUpdate = async () => {
    if (!selectedUser) return;
    
    try {
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          role: formData.role,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '更新用户失败');
      }
      
      setShowEditDialog(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败');
    }
  };

  // 删除用户
  const handleDelete = async () => {
    if (!selectedUser) return;
    
    try {
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '删除用户失败');
      }
      
      setShowDeleteDialog(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  };

  // 打开编辑对话框
  const openEditDialog = (user: UserItem) => {
    setSelectedUser(user);
    setFormData({
      email: user.email,
      name: user.name,
      password: '',
      role: user.role,
    });
    setShowEditDialog(true);
  };

  // 打开删除确认
  const openDeleteDialog = (user: UserItem) => {
    setSelectedUser(user);
    setShowDeleteDialog(true);
  };

  // 未登录或非管理员
  if (!isAuthenticated) {
    return (
      <AppShell>
        <Header title="用户管理" />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h2 className="text-xl font-semibold mb-2">请先登录</h2>
            <p className="text-gray-500">访问用户管理需要登录账户</p>
          </div>
        </main>
      </AppShell>
    );
  }

  if (currentUser?.role !== 'admin') {
    return (
      <AppShell>
        <Header title="用户管理" />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-red-400" />
            <h2 className="text-xl font-semibold mb-2">无访问权限</h2>
            <p className="text-gray-500">只有管理员可以访问用户管理页面</p>
          </div>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Header title="用户管理" />

      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-5xl mx-auto">
          {/* 标题和操作栏 */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-primary" />
              <h1 className="text-xl font-semibold">用户列表</h1>
              <Badge variant="default">{total} 位用户</Badge>
            </div>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-1" />
              添加用户
            </Button>
          </div>

          {/* 搜索和筛选 */}
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="搜索邮箱或用户名..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="">所有角色</option>
              <option value="admin">管理员</option>
              <option value="member">成员</option>
              <option value="viewer">只读</option>
            </select>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
              {error}
            </div>
          )}

          {/* 用户列表 */}
          <div className="bg-card rounded-lg border shadow-sm">
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">加载中...</div>
            ) : users.length === 0 ? (
              <div className="p-8 text-center text-gray-500">暂无用户</div>
            ) : (
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">用户</th>
                    <th className="text-left p-3 font-medium">角色</th>
                    <th className="text-left p-3 font-medium">状态</th>
                    <th className="text-left p-3 font-medium">最后登录</th>
                    <th className="text-right p-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            {user.avatar ? (
                              <img src={user.avatar} alt="" className="w-10 h-10 rounded-full" />
                            ) : (
                              <User className="w-5 h-5 text-primary" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-sm text-gray-500 flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge className={ROLE_CONFIG[user.role].color}>
                          {ROLE_CONFIG[user.role].label}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {user.emailVerified ? (
                          <Badge variant="success">已验证</Badge>
                        ) : (
                          <Badge variant="default">未验证</Badge>
                        )}
                      </td>
                      <td className="p-3 text-sm text-gray-500">
                        {user.lastLoginAt ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(user.lastLoginAt).toLocaleDateString('zh-CN')}
                          </div>
                        ) : (
                          '从未登录'
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(user)}
                            disabled={user.id === currentUser?.id}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog(user)}
                            disabled={user.id === currentUser?.id}
                            className="text-red-500 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* 分页 */}
          {total > 20 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                上一页
              </Button>
              <span className="px-3 py-2 text-sm">
                第 {page} 页，共 {Math.ceil(total / 20)} 页
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= Math.ceil(total / 20)}
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* 创建用户对话框 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">添加用户</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">邮箱 *</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">用户名 *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="用户名"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">密码 *</label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="至少 8 位"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">角色</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="member">成员</option>
                <option value="admin">管理员</option>
                <option value="viewer">只读</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="ghost" onClick={() => setShowCreateDialog(false)}>
              取消
            </Button>
            <Button onClick={handleCreate}>创建</Button>
          </div>
        </div>
      </Dialog>

      {/* 编辑用户对话框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">编辑用户</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">邮箱</label>
              <Input value={formData.email} disabled className="bg-muted" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">用户名</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">角色</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="member">成员</option>
                <option value="admin">管理员</option>
                <option value="viewer">只读</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="ghost" onClick={() => setShowEditDialog(false)}>
              取消
            </Button>
            <Button onClick={handleUpdate}>保存</Button>
          </div>
        </div>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-2">确认删除</h2>
          <p className="text-gray-500 mb-4">
            确定要删除用户 <span className="font-medium">{selectedUser?.name}</span> 吗？
            此操作不可撤销。
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowDeleteDialog(false)}>
              取消
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              删除
            </Button>
          </div>
        </div>
      </Dialog>
    </AppShell>
  );
}
