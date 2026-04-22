<template>
  <div class="page">
    <h2 class="page-title">组织管理</h2>

    <!-- 搜索栏 -->
    <div class="search-bar">
      <t-input v-model="search.keyword" placeholder="搜索组织名称/描述" style="width: 220px" @enter="loadData" />
      <t-button theme="primary" @click="loadData">搜索</t-button>
      <t-button variant="outline" @click="resetSearch">重置</t-button>
    </div>

    <!-- 功能栏 -->
    <div class="toolbar">
      <t-button theme="primary" @click="showAddDialog">
        <template #icon><t-icon name="add" /></template>
        新增组织
      </t-button>
    </div>

    <!-- 表格 -->
    <div class="table-wrapper">
      <t-table :data="tableData" :columns="columns" row-key="id" hover stripe :pagination="null">
        <template #member_count="{ row }">
          <t-tag theme="primary" variant="outline">{{ row.member_count }} 人</t-tag>
        </template>
        <template #admin_count="{ row }">
          <t-tag theme="warning" variant="outline">{{ row.admin_count }} 人</t-tag>
        </template>
        <template #action="{ row }">
          <t-button variant="text" size="small" theme="primary" @click="handleView(row)">查看</t-button>
          <t-button variant="text" size="small" theme="primary" @click="handleEdit(row)">编辑</t-button>
          <t-button variant="text" size="small" theme="primary" @click="handleManageMembers(row)">成员管理</t-button>
          <t-button variant="text" size="small" theme="danger" @click="handleDelete(row)">删除</t-button>
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
    <t-dialog v-model:visible="editDialogVisible" :header="isEdit ? '编辑组织' : '新增组织'" :footer="false" width="500px">
      <t-form :data="form" :rules="formRules" @submit="handleSubmit" label-width="100px">
        <t-form-item label="组织名称" name="name">
          <t-input v-model="form.name" placeholder="请输入组织名称" />
        </t-form-item>
        <t-form-item label="描述" name="description">
          <t-textarea v-model="form.description" placeholder="请输入组织描述" :autosize="{ minRows: 2, maxRows: 4 }" />
        </t-form-item>
        <t-form-item label="组织管理员" name="admin_ids">
          <t-select
            v-model="form.admin_ids"
            :options="availableUsers"
            multiple
            filterable
            placeholder="选择组织管理员"
            style="width: 100%"
          />
        </t-form-item>
        <t-form-item>
          <t-button type="submit" theme="primary">{{ isEdit ? '保存' : '新增' }}</t-button>
          <t-button variant="outline" @click="editDialogVisible = false" style="margin-left: 12px">取消</t-button>
        </t-form-item>
      </t-form>
    </t-dialog>

    <!-- 查看详情弹窗 -->
    <t-dialog v-model:visible="viewDialogVisible" header="组织详情" :footer="false" width="500px">
      <t-descriptions :column="1" bordered>
        <t-descriptions-item label="组织名称">{{ viewData.name }}</t-descriptions-item>
        <t-descriptions-item label="描述">{{ viewData.description || '-' }}</t-descriptions-item>
        <t-descriptions-item label="成员数量">{{ viewData.member_count }} 人</t-descriptions-item>
        <t-descriptions-item label="管理员数量">{{ viewData.admin_count }} 人</t-descriptions-item>
        <t-descriptions-item label="创建时间">{{ viewData.created_at }}</t-descriptions-item>
        <t-descriptions-item label="更新时间">{{ viewData.updated_at }}</t-descriptions-item>
      </t-descriptions>
      <div v-if="viewData.admins && viewData.admins.length" style="margin-top: 16px">
        <h4 style="margin-bottom: 8px">管理员列表</h4>
        <t-space :gutter="8">
          <t-tag v-for="admin in viewData.admins" :key="admin.id" theme="warning">{{ admin.nickname }} ({{ admin.username }})</t-tag>
        </t-space>
      </div>
    </t-dialog>

    <!-- 成员管理弹窗 -->
    <t-dialog v-model:visible="memberDialogVisible" header="成员管理" :footer="false" width="700px">
      <div class="member-header">
        <t-alert theme="info" style="flex: 1">
          当前组织：{{ currentOrg?.name }}
        </t-alert>
      </div>

      <div class="member-toolbar">
        <t-button theme="primary" size="small" @click="showAddMemberDialog">
          <template #icon><t-icon name="add" /></template>
          添加成员
        </t-button>
      </div>

      <t-table :data="members" :columns="memberColumns" row-key="id" hover stripe :pagination="null" size="small">
        <template #is_admin="{ row }">
          <t-tag :theme="row.is_admin ? 'warning' : 'default'" variant="outline">
            {{ row.is_admin ? '管理员' : '成员' }}
          </t-tag>
        </template>
        <template #action="{ row }">
          <t-button variant="text" size="small" theme="primary" @click="handleRemoveMember(row)">移出组织</t-button>
        </template>
      </t-table>

      <!-- 添加成员弹窗 -->
      <t-dialog v-model:visible="addMemberDialogVisible" header="添加成员" :footer="false" width="500px">
        <t-form label-width="100px">
          <t-form-item label="选择用户">
            <t-select
              v-model="newMemberId"
              :options="availableMemberOptions"
              filterable
              placeholder="搜索并选择用户"
              style="width: 100%"
            />
          </t-form-item>
          <t-form-item>
            <t-button theme="primary" @click="handleAddMember">确认添加</t-button>
            <t-button variant="outline" @click="addMemberDialogVisible = false" style="margin-left: 12px">取消</t-button>
          </t-form-item>
        </t-form>
      </t-dialog>
    </t-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next';
import { organizationAPI } from '@/api';

const search = reactive({ keyword: '' });
const tableData = ref([]);
const pagination = reactive({ page: 1, pageSize: 10, total: 0 });

// 新增/编辑
const editDialogVisible = ref(false);
const isEdit = ref(false);
const editId = ref(null);
const form = ref({ name: '', description: '', admin_ids: [] });
const formRules = { name: [{ required: true, message: '组织名称不能为空' }] };
const availableUsers = ref([]);

// 查看详情
const viewDialogVisible = ref(false);
const viewData = ref({});

// 成员管理
const memberDialogVisible = ref(false);
const currentOrg = ref(null);
const members = ref([]);
const addMemberDialogVisible = ref(false);
const newMemberId = ref(null);

const columns = [
  { colKey: 'id', title: 'ID', width: 60 },
  { colKey: 'name', title: '组织名称', width: 200 },
  { colKey: 'description', title: '描述', ellipsis: true },
  { colKey: 'member_count', title: '成员数量', width: 100, slot: 'member_count' },
  { colKey: 'admin_count', title: '管理员数量', width: 110, slot: 'admin_count' },
  { colKey: 'updated_at', title: '更新时间', width: 170 },
  { colKey: 'action', title: '操作', width: 250, slot: 'action', fixed: 'right' },
];

const memberColumns = [
  { colKey: 'id', title: 'ID', width: 60 },
  { colKey: 'username', title: '用户名', width: 120 },
  { colKey: 'nickname', title: '昵称', width: 120 },
  { colKey: 'is_admin', title: '角色', width: 80, slot: 'is_admin' },
  { colKey: 'created_at', title: '加入时间', width: 170 },
  { colKey: 'action', title: '操作', width: 100, slot: 'action' },
];

const availableMemberOptions = ref([]);

const loadData = async () => {
  try {
    const params = { page: pagination.page, pageSize: pagination.pageSize };
    if (search.keyword) params.keyword = search.keyword;
    const res = await organizationAPI.list(params);
    tableData.value = res.data.list;
    pagination.total = res.data.total;
  } catch (e) {
    MessagePlugin.error(e.message || '加载失败');
  }
};

const resetSearch = () => {
  search.keyword = '';
  pagination.page = 1;
  loadData();
};

const loadAvailableUsers = async () => {
  try {
    const res = await organizationAPI.getAvailableUsers();
    availableUsers.value = (res.data || []).map(u => ({
      value: u.id,
      label: `${u.nickname} (${u.username})`,
    }));
  } catch {}
};

const showAddDialog = () => {
  isEdit.value = false;
  editId.value = null;
  form.value = { name: '', description: '', admin_ids: [] };
  loadAvailableUsers();
  editDialogVisible.value = true;
};

const handleEdit = (row) => {
  isEdit.value = true;
  editId.value = row.id;
  form.value = { name: row.name, description: row.description || '', admin_ids: [] };
  loadAvailableUsers();
  editDialogVisible.value = true;
};

const handleSubmit = async ({ validateResult }) => {
  if (validateResult !== true) return;
  try {
    if (isEdit.value) {
      await organizationAPI.update(editId.value, form.value);
      MessagePlugin.success('更新成功');
    } else {
      await organizationAPI.create(form.value);
      MessagePlugin.success('创建成功');
    }
    editDialogVisible.value = false;
    loadData();
  } catch (e) {
    MessagePlugin.error(e.message || '操作失败');
  }
};

const handleView = async (row) => {
  try {
    const res = await organizationAPI.get(row.id);
    viewData.value = res.data;
    viewDialogVisible.value = true;
  } catch (e) {
    MessagePlugin.error(e.message || '加载失败');
  }
};

const handleDelete = (row) => {
  const dialog = DialogPlugin.confirm({
    header: '确认删除',
    body: `确定删除组织"${row.name}"吗？`,
    theme: 'warning',
    confirmBtn: { content: '确认', theme: 'danger' },
    onConfirm: async () => {
      dialog.destroy();
      try {
        await organizationAPI.delete(row.id);
        MessagePlugin.success('删除成功');
        loadData();
      } catch (e) {
        MessagePlugin.error(e.message || '删除失败');
      }
    },
    onCancel: () => {
      dialog.destroy();
    },
  });
};

const handleManageMembers = async (row) => {
  currentOrg.value = row;
  try {
    const res = await organizationAPI.getMembers(row.id);
    members.value = res.data;
    memberDialogVisible.value = true;
  } catch (e) {
    MessagePlugin.error(e.message || '加载失败');
  }
};

const showAddMemberDialog = async () => {
  newMemberId.value = null;
  // 加载可添加的用户（不在当前组织中的用户）
  try {
    const res = await organizationAPI.getAvailableUsers();
    const currentMemberIds = members.value.map(m => m.id);
    availableMemberOptions.value = (res.data || [])
      .filter(u => !currentMemberIds.includes(u.id))
      .map(u => ({
        value: u.id,
        label: `${u.nickname} (${u.username})${u.organization_name ? ' - ' + u.organization_name : ''}`,
      }));
    addMemberDialogVisible.value = true;
  } catch (e) {
    MessagePlugin.error(e.message || '加载失败');
  }
};

const handleAddMember = async () => {
  if (!newMemberId.value) {
    MessagePlugin.warning('请选择用户');
    return;
  }
  try {
    await organizationAPI.addMember(currentOrg.value.id, newMemberId.value);
    MessagePlugin.success('添加成功');
    addMemberDialogVisible.value = false;
    // 重新加载成员列表
    const res = await organizationAPI.getMembers(currentOrg.value.id);
    members.value = res.data;
  } catch (e) {
    MessagePlugin.error(e.message || '添加失败');
  }
};

const handleRemoveMember = (row) => {
  const dialog = DialogPlugin.confirm({
    header: '确认移除',
    body: `确定将用户"${row.nickname}"移出组织吗？`,
    theme: 'warning',
    confirmBtn: { content: '确认', theme: 'danger' },
    onConfirm: async () => {
      dialog.destroy();
      try {
        await organizationAPI.removeMember(currentOrg.value.id, row.id);
        MessagePlugin.success('移除成功');
        const res = await organizationAPI.getMembers(currentOrg.value.id);
        members.value = res.data;
      } catch (e) {
        MessagePlugin.error(e.message || '移除失败');
      }
    },
    onCancel: () => {
      dialog.destroy();
    },
  });
};

onMounted(() => {
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
.member-header { margin-bottom: 16px; }
.member-toolbar { margin-bottom: 12px; }
</style>
