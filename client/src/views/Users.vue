<template>
  <div class="page">
    <h2 class="page-title">用户管理</h2>

    <!-- 搜索栏 -->
    <div class="search-bar">
      <t-input v-model="search.keyword" placeholder="搜索用户名/昵称" style="width: 220px" @enter="loadData" />
      <t-button theme="primary" @click="loadData">搜索</t-button>
      <t-button variant="outline" @click="resetSearch">重置</t-button>
    </div>

    <!-- 功能栏 -->
    <div class="toolbar">
      <t-button v-if="isSystemAdmin" theme="primary" @click="showAddDialog">
        <template #icon><t-icon name="add" /></template>
        新增用户
      </t-button>
      <t-button v-if="selectedRows.length && isSystemAdmin" theme="danger" variant="outline" @click="handleBatchDelete">
        <template #icon><t-icon name="delete" /></template>
        批量删除 ({{ selectedRows.length }})
      </t-button>
    </div>

    <!-- 表格 -->
    <div class="table-wrapper">
      <t-table
        :data="tableData"
        :columns="columns"
        row-key="id"
        hover
        stripe
        :pagination="null"
        :selected-row-keys="selectedRows"
        @select-change="handleSelectChange"
      >
        <template #is_admin="{ row }">
          <t-tag :theme="row.is_admin ? 'warning' : 'default'" variant="outline">
            {{ row.is_admin ? '系统管理员' : '普通用户' }}
          </t-tag>
        </template>
        <template #organization_name="{ row }">
          {{ row.organization_name || '未分配' }}
        </template>
        <template #action="{ row }">
          <t-button variant="text" size="small" theme="primary" @click="handleEdit(row)">编辑</t-button>
          <t-button v-if="isSystemAdmin && row.id !== currentUserId" variant="text" size="small" theme="danger" @click="handleDelete(row)">删除</t-button>
        </template>
      </t-table>
    </div>

    <!-- 分页 -->
    <div class="pagination-wrapper">
      <t-pagination
        v-model="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-size-options="[10, 20, 50, 100]"
        @change="loadData"
      />
    </div>

    <!-- 新增/编辑弹窗 -->
    <t-dialog v-model:visible="editDialogVisible" :header="isEdit ? '编辑用户' : '新增用户'" :footer="false" width="500px">
      <t-form :data="form" :rules="formRules" @submit="handleSubmit" label-width="100px">
        <t-form-item label="用户名" name="username">
          <t-input v-model="form.username" placeholder="请输入用户名" :disabled="isEdit" />
        </t-form-item>
        <t-form-item :label="isEdit ? '新密码' : '密码'" name="password">
          <t-input v-model="form.password" type="password" :placeholder="isEdit ? '留空则不修改' : '请输入密码'" />
        </t-form-item>
        <t-form-item label="昵称" name="nickname">
          <t-input v-model="form.nickname" placeholder="请输入昵称" />
        </t-form-item>
        <t-form-item v-if="isSystemAdmin" label="所属组织" name="organization_id">
          <t-select v-model="form.organization_id" :options="organizationOptions" clearable filterable placeholder="选择所属组织" style="width: 100%" />
        </t-form-item>
        <t-form-item v-if="isSystemAdmin" label="系统管理员" name="is_admin">
          <t-switch v-model="form.is_admin" />
        </t-form-item>
        <t-form-item>
          <t-button type="submit" theme="primary">{{ isEdit ? '保存' : '新增' }}</t-button>
          <t-button variant="outline" @click="editDialogVisible = false" style="margin-left: 12px">取消</t-button>
        </t-form-item>
      </t-form>
    </t-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next';
import { userAPI } from '@/api';

const search = reactive({ keyword: '' });
const tableData = ref([]);
const selectedRows = ref([]);
const pagination = reactive({ page: 1, pageSize: 10, total: 0 });
const isSystemAdmin = ref(false);
const currentUserId = ref(null);

// 组织选项
const organizationOptions = ref([]);

// 新增/编辑
const editDialogVisible = ref(false);
const isEdit = ref(false);
const editId = ref(null);
const form = ref({ username: '', password: '', nickname: '', organization_id: null, is_admin: false });
const formRules = {
  username: [{ required: true, message: '用户名不能为空' }],
  nickname: [{ required: true, message: '昵称不能为空' }],
};

const columns = [
  { colKey: 'row-select', type: 'multiple', width: 50 },
  { colKey: 'id', title: 'ID', width: 60 },
  { colKey: 'username', title: '用户名', width: 150 },
  { colKey: 'nickname', title: '昵称', width: 150 },
  { colKey: 'organization_name', title: '所属组织', width: 150, slot: 'organization_name' },
  { colKey: 'is_admin', title: '角色', width: 120, slot: 'is_admin' },
  { colKey: 'created_at', title: '创建时间', width: 170 },
  { colKey: 'updated_at', title: '更新时间', width: 170 },
  { colKey: 'action', title: '操作', width: 150, slot: 'action', fixed: 'right' },
];

const loadData = async () => {
  try {
    const params = { page: pagination.page, pageSize: pagination.pageSize };
    if (search.keyword) params.keyword = search.keyword;
    const res = await userAPI.list(params);
    tableData.value = res.data.list;
    pagination.total = res.data.total;
    isSystemAdmin.value = res.data.is_system_admin;
  } catch (e) {
    MessagePlugin.error(e.message || '加载失败');
  }
};

const loadOrganizations = async () => {
  try {
    const res = await userAPI.getOrganizations();
    organizationOptions.value = (res.data || []).map(o => ({
      value: o.id,
      label: o.name,
    }));
  } catch {}
};

const resetSearch = () => {
  search.keyword = '';
  pagination.page = 1;
  loadData();
};

const handleSelectChange = (value) => {
  selectedRows.value = value;
};

const showAddDialog = () => {
  isEdit.value = false;
  editId.value = null;
  form.value = { username: '', password: '', nickname: '', organization_id: null, is_admin: false };
  loadOrganizations();
  editDialogVisible.value = true;
};

const handleEdit = (row) => {
  isEdit.value = true;
  editId.value = row.id;
  form.value = {
    username: row.username,
    password: '',
    nickname: row.nickname,
    organization_id: row.organization_id,
    is_admin: row.is_admin === 1,
  };
  loadOrganizations();
  editDialogVisible.value = true;
};

const handleSubmit = async ({ validateResult }) => {
  if (validateResult !== true) return;

  const payload = { ...form.value };
  // 如果密码为空，删除密码字段（编辑时不修改密码）
  if (!payload.password) delete payload.password;
  // 转换布尔值
  payload.is_admin = payload.is_admin ? 1 : 0;

  try {
    if (isEdit.value) {
      await userAPI.update(editId.value, payload);
      MessagePlugin.success('更新成功');
    } else {
      await userAPI.create(payload);
      MessagePlugin.success('创建成功');
    }
    editDialogVisible.value = false;
    loadData();
  } catch (e) {
    MessagePlugin.error(e.message || '操作失败');
  }
};

const handleDelete = async (row) => {
  const confirmed = await DialogPlugin.confirm({
    header: '确认删除',
    body: `确定删除用户"${row.nickname}"吗？`,
    theme: 'warning',
    confirmBtn: { content: '确认', theme: 'danger' },
  });
  if (!confirmed) return;
  try {
    await userAPI.delete(row.id);
    MessagePlugin.success('删除成功');
    loadData();
  } catch (e) {
    MessagePlugin.error(e.message || '删除失败');
  }
};

const handleBatchDelete = async () => {
  const confirmed = await DialogPlugin.confirm({
    header: '批量删除',
    body: `确定删除选中的 ${selectedRows.value.length} 个用户吗？`,
    theme: 'warning',
    confirmBtn: { content: '确认', theme: 'danger' },
  });
  if (!confirmed) return;

  try {
    await Promise.all(selectedRows.value.map(id => userAPI.delete(id)));
    MessagePlugin.success('批量删除成功');
    selectedRows.value = [];
    loadData();
  } catch (e) {
    MessagePlugin.error(e.message || '删除失败');
  }
};

onMounted(() => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  currentUserId.value = user.id;
  loadData();
});
</script>

<style scoped>
.page { background: #fff; padding: 20px 24px; border-radius: 8px; height: 100%; overflow: hidden; display: flex; flex-direction: column; }
.page-title { font-size: 20px; margin-bottom: 16px; flex-shrink: 0; }
.search-bar { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; align-items: center; flex-shrink: 0; }
.toolbar { display: flex; gap: 8px; margin-bottom: 12px; flex-shrink: 0; }
.table-wrapper { flex: 1; overflow: hidden; min-height: 0; }
.table-wrapper :deep(.t-table) { height: 100%; display: flex; flex-direction: column; }
.table-wrapper :deep(.t-table__header) { flex-shrink: 0; }
.table-wrapper :deep(.t-table__body) { flex: 1; overflow-y: auto; }
.pagination-wrapper { flex-shrink: 0; margin-top: 12px; }
</style>
