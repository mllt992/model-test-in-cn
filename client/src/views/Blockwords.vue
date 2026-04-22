<template>
  <div class="page">
    <h2 class="page-title">拦截词管理</h2>

    <!-- 搜索 & 操作栏 -->
    <div class="toolbar">
      <t-input v-model="searchKeyword" placeholder="搜索拦截词或类别" style="width: 300px" @enter="loadData">
        <template #suffix-icon><t-icon name="search" /></template>
      </t-input>
      <t-button theme="primary" @click="loadData">搜索</t-button>
      <t-button variant="outline" @click="resetSearch">重置</t-button>
      <div style="flex: 1" />
      <t-button theme="primary" @click="showAddDialog">
        <template #icon><t-icon name="add" /></template>
        新增
      </t-button>
      <t-button theme="danger" variant="outline" :disabled="!selectedRows.length" @click="handleBatchDelete">
        <template #icon><t-icon name="delete" /></template>
        批量删除 ({{ selectedRows.length }})
      </t-button>
    </div>

    <!-- 表格 -->
    <t-table
      :data="tableData"
      :columns="columns"
      row-key="id"
      hover
      stripe
      :selected-row-keys="selectedRows"
      @select-change="handleSelectChange"
    >
      <template #level="{ row }">
        <t-tag :theme="levelTheme(row.level)" variant="outline">{{ levelLabel(row.level) }}</t-tag>
      </template>
      <template #action="{ row }">
        <t-link theme="primary" hover="color" @click="handleEdit(row)">编辑</t-link>
        <t-link theme="danger" hover="color" @click="handleDelete(row)" style="margin-left: 8px">删除</t-link>
      </template>
    </t-table>

    <!-- 分页 -->
    <div class="pagination-wrapper">
      <t-pagination
        v-model="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-size-options="[10, 20, 50]"
        @change="loadData"
      />
    </div>

    <!-- 新增/编辑弹窗 -->
    <t-dialog
      v-model:visible="dialogVisible"
      :header="isEdit ? '编辑拦截词' : '新增拦截词'"
      :footer="false"
      width="500px"
    >
      <t-form :data="form" :rules="formRules" @submit="handleSubmit" label-width="80px">
        <t-form-item label="拦截词" name="word">
          <t-input v-model="form.word" placeholder="请输入拦截词" />
        </t-form-item>
        <t-form-item label="类别" name="category">
          <t-input v-model="form.category" placeholder="请输入类别" />
        </t-form-item>
        <t-form-item label="级别" name="level">
          <t-select v-model="form.level">
            <t-option value="1" label="低风险" />
            <t-option value="2" label="中风险" />
            <t-option value="3" label="高风险" />
          </t-select>
        </t-form-item>
        <t-form-item>
          <t-button type="submit" theme="primary">{{ isEdit ? '保存' : '新增' }}</t-button>
          <t-button variant="outline" @click="dialogVisible = false" style="margin-left: 12px">取消</t-button>
        </t-form-item>
      </t-form>
    </t-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next';
import { blockwordsAPI } from '@/api';

const searchKeyword = ref('');
const tableData = ref([]);
const selectedRows = ref([]);
const pagination = reactive({ page: 1, pageSize: 10, total: 0 });
const dialogVisible = ref(false);
const isEdit = ref(false);
const editId = ref(null);

const form = ref({ word: '', category: '', level: '1' });
const formRules = { word: [{ required: true, message: '拦截词不能为空' }] };

const columns = [
  { colKey: 'row-select', type: 'multiple', width: 50 },
  { colKey: 'id', title: 'ID', width: 80 },
  { colKey: 'word', title: '拦截词', ellipsis: true },
  { colKey: 'category', title: '类别', width: 140 },
  { colKey: 'level', title: '级别', width: 100, cell: 'level' },
  { colKey: 'created_at', title: '创建时间', width: 170 },
  { colKey: 'updated_at', title: '更新时间', width: 170 },
  { colKey: 'action', title: '操作', width: 130, cell: 'action', fixed: 'right' },
];

const user = JSON.parse(localStorage.getItem('user') || '{}');

const levelLabel = (level) => ({ 1: '低风险', 2: '中风险', 3: '高风险' }[level] || '未知');
const levelTheme = (level) => ({ 1: 'success', 2: 'warning', 3: 'danger' }[level] || 'default');

const loadData = async () => {
  const res = await blockwordsAPI.list({
    keyword: searchKeyword.value,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });
  tableData.value = res.data.list;
  pagination.total = res.data.total;
  selectedRows.value = [];
};

const resetSearch = () => {
  searchKeyword.value = '';
  pagination.page = 1;
  loadData();
};

const handleSelectChange = (value) => {
  selectedRows.value = value;
};

const showAddDialog = () => {
  isEdit.value = false;
  editId.value = null;
  form.value = { word: '', category: '', level: '1' };
  dialogVisible.value = true;
};

const handleEdit = (row) => {
  isEdit.value = true;
  editId.value = row.id;
  form.value = { word: row.word, category: row.category, level: String(row.level) };
  dialogVisible.value = true;
};

const handleSubmit = async ({ validateResult }) => {
  if (validateResult !== true) return;
  try {
    if (isEdit.value) {
      await blockwordsAPI.update(editId.value, { ...form.value, level: Number(form.value.level), updater_id: user.id });
      MessagePlugin.success('更新成功');
    } else {
      await blockwordsAPI.create({ ...form.value, level: Number(form.value.level), creator_id: user.id });
      MessagePlugin.success('新增成功');
    }
    dialogVisible.value = false;
    loadData();
  } catch {}
};

const handleDelete = (row) => {
  const dialog = DialogPlugin.confirm({
    header: '确认删除',
    body: '确定删除该拦截词吗？',
    theme: 'warning',
    confirmBtn: { content: '确认', theme: 'danger' },
    onConfirm: async () => {
      dialog.destroy();
      try {
        await blockwordsAPI.delete(row.id);
        MessagePlugin.success('删除成功');
        loadData();
      } catch {}
    },
    onCancel: () => {
      dialog.destroy();
    },
  });
};

const handleBatchDelete = () => {
  const dialog = DialogPlugin.confirm({
    header: '批量删除',
    body: `确定删除选中的 ${selectedRows.value.length} 条记录吗？`,
    theme: 'warning',
    confirmBtn: { content: '确认', theme: 'danger' },
    onConfirm: async () => {
      dialog.destroy();
      try {
        for (const id of selectedRows.value) {
          await blockwordsAPI.delete(id);
        }
        MessagePlugin.success('批量删除成功');
        loadData();
      } catch {}
    },
    onCancel: () => {
      dialog.destroy();
    },
  });
};

onMounted(loadData);
</script>

<style scoped>
.page {
  background: #fff;
  padding: 20px 24px;
  border-radius: 8px;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.page-title { font-size: 18px; font-weight: 600; margin-bottom: 16px; flex-shrink: 0; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; flex-shrink: 0; flex-wrap: wrap; align-items: center; }
.pagination-wrapper { flex-shrink: 0; margin-top: 16px; display: flex; justify-content: flex-end; }
</style>
