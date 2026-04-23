<template>
  <div class="page">
    <h2 class="page-title">测试题管理</h2>

    <!-- 搜索栏 -->
    <div class="search-bar">
      <t-input v-model="search.keyword" placeholder="题目/类别/模型回答" style="width: 220px" @enter="loadData" />
      <t-select v-model="search.type" placeholder="类型" clearable filterable style="width: 160px">
        <t-option v-for="t in typeOptions" :key="t" :value="t" :label="t" />
      </t-select>
      <t-select v-model="search.category" placeholder="类别" clearable filterable style="width: 160px">
        <t-option v-for="c in categoryOptions" :key="c" :value="c" :label="c" />
      </t-select>
      <t-select v-model="search.is_answered" placeholder="是否回答" clearable style="width: 140px">
        <t-option value="0" label="未回答" />
        <t-option value="1" label="已回答" />
      </t-select>
      <t-select v-model="search.is_refused" placeholder="是否拒答" clearable style="width: 120px">
        <t-option value="0" label="否" />
        <t-option value="1" label="是" />
      </t-select>
      <t-select v-model="search.audit_count" placeholder="人工审核" clearable style="width: 140px">
        <t-option value="1" label=">=1人同意" />
        <t-option value="2" label=">=2人同意" />
      </t-select>
      <t-input v-model="search.audit_names" placeholder="审核人名字" style="width: 140px" @enter="loadData" />
      <t-button theme="primary" @click="loadData">搜索</t-button>
      <t-button variant="outline" @click="resetSearch">重置</t-button>
    </div>

    <!-- 功能栏 -->
    <div class="toolbar">
      <t-button theme="primary" @click="showAddDialog">
        <template #icon><t-icon name="add" /></template>
        新增
      </t-button>
      <t-button variant="outline" @click="showImportDialog">
        <template #icon><t-icon name="upload" /></template>
        导入
      </t-button>
      <t-button variant="outline" @click="showExportDialog">
        <template #icon><t-icon name="download" /></template>
        导出
      </t-button>
      <t-button variant="outline" @click="showDuplicateDialog" :loading="duplicateLoading">
        <template #icon><t-icon name="scan" /></template>
        重复检测
      </t-button>
      <t-button v-if="selectedRows.length" theme="danger" variant="outline" @click="handleBatchDelete">
        <template #icon><t-icon name="delete" /></template>
        批量删除 ({{ selectedRows.length }})
      </t-button>
      <t-button v-if="selectedRows.length" variant="outline" @click="showBatchTypeDialog">
        <template #icon><t-icon name="edit" /></template>
        批量设置类型 ({{ selectedRows.length }})
      </t-button>
      <t-button v-if="selectedRows.length" variant="outline" @click="showBatchCategoryDialog">
        <template #icon><t-icon name="edit" /></template>
        批量设置类别 ({{ selectedRows.length }})
      </t-button>
      <t-button v-if="selectedRows.length" variant="outline" @click="handleBatchAIAnswer" :loading="batchAIAnswerLoading">
        <template #icon><t-icon name="refresh" /></template>
        {{ batchAIAnswerLoading && batchReanswerProgress.total ? `回答中 ${batchReanswerProgress.current}/${batchReanswerProgress.total}` : `批量重新回答 (${selectedRows.length})` }}
      </t-button>

      <!-- 拒答比例（右侧） -->
      <div class="refuse-rate">
        <span class="rate-label">拒答比例</span>
        <t-tag theme="danger" variant="outline">{{ refusalRate }}</t-tag>
      </div>

      <!-- 列设置 -->
      <t-popup trigger="click" placement="bottom-end">
        <t-button variant="outline" shape="square">
          <template #icon><t-icon name="setting" /></template>
        </t-button>
        <template #content>
          <div class="column-settings">
            <h4>显示列</h4>
            <t-checkbox-group v-model="visibleColumns" @change="handleColumnVisibilityChange">
              <t-checkbox v-for="opt in columnVisibilityOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</t-checkbox>
            </t-checkbox-group>
          </div>
        </template>
      </t-popup>
    </div>

    <!-- 表格 -->
    <div class="table-wrapper">
      <t-table :data="tableData" :columns="columns" row-key="id" hover stripe :pagination="null"
        :selected-row-keys="selectedRows" @select-change="handleSelectChange"
        table-layout="fixed" resizable
        @column-resize-change="handleColumnResizeChange"
      >
      <template #index="{ row }">{{ row.index }}</template>
      <template #type="{ row }">{{ row.type || '-' }}</template>
      <template #is_answered="{ row }">
        <t-tag :theme="row.model_answer ? 'success' : 'default'" variant="outline">
          {{ row.model_answer ? '是' : '否' }}
        </t-tag>
      </template>
      <template #is_refused="{ row }">
        <t-tag :theme="row.is_refused === 1 ? 'danger' : 'success'" variant="outline">
          {{ row.is_refused === 1 ? '是' : '否' }}
        </t-tag>
      </template>
      <template #audit_results="{ row }">
        <t-space v-if="row.audit_results && row.audit_results.length" :gutter="4">
          <t-tag v-for="(a, i) in row.audit_results" :key="i" size="small" theme="primary" variant="light">
            {{ a.name }}
          </t-tag>
        </t-space>
        <span v-else style="color: #bbb">-</span>
      </template>
      <template #action="{ row }">
        <t-button variant="text" size="small" theme="primary" @click="handleAIAnswer(row)" :loading="aiAnswerLoading[row.id]">AI回答</t-button>
        <t-button variant="text" size="small" @click="handleViewOriginal(row)">查看原始内容</t-button>
        <t-button v-if="!isUserApproved(row)" variant="text" size="small" theme="success" @click="handleApprove(row)">同意</t-button>
        <t-button v-else variant="text" size="small" theme="warning" @click="handleRevokeApprove(row)">撤销同意</t-button>
        <t-button variant="text" size="small" @click="handleEdit(row)">编辑</t-button>
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
    <t-dialog v-model:visible="editDialogVisible" :header="isEdit ? '编辑题目' : '新增题目'" :footer="false" width="600px">
      <t-form :data="form" :rules="formRules" @submit="handleSubmit" label-width="100px">
        <t-form-item label="类型" name="type">
          <t-input v-model="form.type" placeholder="如：文本生成、图像生成" />
        </t-form-item>
        <t-form-item label="题目" name="question">
          <t-textarea v-model="form.question" placeholder="请输入题目内容" />
        </t-form-item>
        <t-form-item label="类别" name="category">
          <t-input v-model="form.category" placeholder="请输入类别" />
        </t-form-item>
        <t-form-item label="模型回答" name="model_answer">
          <t-textarea v-model="form.model_answer" placeholder="请输入模型回答" />
        </t-form-item>
        <t-form-item label="是否回答" name="is_answered">
          <t-select v-model="form.is_answered">
            <t-option value="-1" label="全部" />
            <t-option value="0" label="未回答" />
            <t-option value="1" label="已回答" />
          </t-select>
        </t-form-item>
        <t-form-item label="是否拒答" name="is_refused">
          <t-select v-model="form.is_refused">
            <t-option value="0" label="未拒答" />
            <t-option value="1" label="已拒答" />
          </t-select>
        </t-form-item>
        <t-form-item label="备注" name="remark">
          <t-textarea v-model="form.remark" placeholder="备注信息" />
        </t-form-item>
        <t-form-item label="审核结果" name="audit_results">
          <div class="audit-list">
            <div v-for="(a, i) in form.audit_results" :key="i" class="audit-item">
              <t-input v-model="a.name" placeholder="姓名" style="width: 150px" />
              <t-input v-model="a.result" placeholder="结果" style="width: 150px" />
              <t-button variant="text" theme="danger" size="small" @click="removeAudit(i)">删除</t-button>
            </div>
            <t-button variant="outline" size="small" @click="addAudit">+ 添加审核人</t-button>
          </div>
        </t-form-item>
        <t-form-item>
          <t-button type="submit" theme="primary">{{ isEdit ? '保存' : '新增' }}</t-button>
          <t-button variant="outline" @click="editDialogVisible = false" style="margin-left: 12px">取消</t-button>
        </t-form-item>
      </t-form>
    </t-dialog>

    <!-- 导入弹窗 -->
    <t-dialog v-model:visible="importDialogVisible" header="导入数据" width="800px" :footer="false">
      <!-- Step 1: 上传文件 -->
      <div v-if="importStep === 1">
        <t-space direction="vertical" style="width: 100%">
          <t-upload ref="uploadRef" v-model="uploadFiles" accept=".xlsx,.xls,.csv,.json" :before-upload="() => true" :auto-upload="false" theme="file-input" />
          <t-alert theme="info">支持 Excel (.xlsx/.xls)、CSV (.csv)、JSON (.json) 格式</t-alert>
          <t-button theme="primary" @click="handlePreviewUpload" :loading="importing">解析文件</t-button>
        </t-space>
      </div>

      <!-- Step 2: 选择 Sheet + 字段映射 + 默认值 -->
      <div v-if="importStep === 2">
        <t-space direction="vertical" style="width: 100%">
          <!-- 文件信息 -->
          <t-alert theme="success">已解析文件：{{ importFileName }}</t-alert>

          <!-- Sheet 选择器（仅 Excel 多 Sheet 时显示） -->
          <div v-if="importSheets.length > 1" class="section-box">
            <h4>选择工作表</h4>
            <t-select v-model="selectedSheet" style="width: 300px" @change="handleSheetChange">
              <t-option v-for="s in importSheets" :key="s.name" :value="s.name" :label="`${s.name} (${s.totalRows} 行)`" />
            </t-select>
          </div>

          <!-- 当前 Sheet 预览 -->
          <div v-if="currentSheetData" class="section-box">
            <h4>原始数据预览（前5行）</h4>
            <div class="preview-table">
              <table class="raw-preview-table">
                <thead>
                  <tr>
                    <th v-for="h in currentSheetData.headers" :key="h">{{ h }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, ri) in currentSheetData.preview" :key="ri">
                    <td v-for="(cell, ci) in row" :key="ci">{{ cell }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- 字段映射 -->
          <div v-if="currentSheetData" class="section-box">
            <h4>字段映射（文件列名 → 系统字段）</h4>
            <t-space direction="vertical" style="width: 100%">
              <t-space v-for="header in currentSheetData.headers" :key="header" align="center">
                <span style="width: 160px; color: #333; font-weight: 500">{{ header }}</span>
                <span style="color: #bbb">→</span>
                <t-select v-model="fieldMapping[header]" placeholder="选择映射字段" style="width: 200px" clearable>
                  <t-option v-for="f in systemFields" :key="f.value" :value="f.value" :label="f.label" />
                </t-select>
              </t-space>
            </t-space>
          </div>

          <!-- 默认值配置 -->
          <div class="section-box">
            <h4>缺省字段默认值</h4>
            <p style="color: #888; font-size: 12px; margin-bottom: 8px">当映射字段为空时使用的默认值</p>
            <t-space direction="vertical" style="width: 100%">
              <t-space v-for="f in systemFields" :key="f.value" align="center">
                <span style="width: 120px">{{ f.label }}</span>
                <t-input v-model="defaultValues[f.value]" :placeholder="'默认值'" style="width: 200px" />
              </t-space>
            </t-space>
          </div>

          <div style="text-align: right">
            <t-button @click="importStep = 1">重新选择文件</t-button>
            <t-button theme="primary" style="margin-left: 12px" @click="handleParseImport" :loading="importing">下一步：预览数据</t-button>
          </div>
        </t-space>
      </div>

      <!-- Step 3: 预览确认 -->
      <div v-if="importStep === 3">
        <t-alert theme="success" style="margin-bottom: 16px">解析成功，共 {{ parsedData.length }} 条记录</t-alert>
        <div class="preview-table">
          <t-table :data="parsedData.slice(0, 5)" row-key="index" :columns="previewColumns" />
        </div>
        <p v-if="parsedData.length > 5" style="color: #888; margin-top: 8px">仅显示前5条预览...</p>
        <div style="margin-top: 16px; text-align: right">
          <t-button @click="importStep = 2">返回修改映射</t-button>
          <t-button theme="primary" style="margin-left: 12px" @click="handleConfirmImport" :loading="importing">确认导入</t-button>
        </div>
      </div>
    </t-dialog>

    <!-- 导出弹窗 -->
    <t-dialog v-model:visible="exportDialogVisible" header="导出数据" width="600px">
      <t-form label-width="100px">
        <t-form-item label="导出格式">
          <t-select v-model="exportFormat">
            <t-option value="xlsx" label="Excel (.xlsx)" />
            <t-option value="csv" label="CSV" />
            <t-option value="json" label="JSON" />
          </t-select>
        </t-form-item>
        <t-form-item label="选择导出列">
          <t-space direction="vertical" style="width: 100%">
            <t-checkbox v-model="selectAllExportCols" @change="toggleAllExportCols">全选</t-checkbox>
            <t-checkbox-group v-model="selectedExportCols" :options="exportColumnOptions" />
          </t-space>
        </t-form-item>
        <t-form-item label="列名自定义">
          <t-space direction="vertical" style="width: 100%">
            <t-space v-for="col in selectedExportCols" :key="col" align="center">
              <span style="width: 120px">{{ exportDefaultLabels[col] }}</span>
              <t-input v-model="customExportLabels[col]" placeholder="自定义列名" style="width: 200px" />
            </t-space>
          </t-space>
        </t-form-item>
        <t-form-item>
          <t-button variant="outline" @click="handleStashExportConfig">
            {{ hasSavedConfig ? '更新暂存' : '暂存配置' }}
          </t-button>
          <t-button v-if="hasSavedConfig" variant="text" size="small" style="margin-left: 8px" @click="handleClearExportConfig">清除暂存</t-button>
          <t-button theme="primary" style="margin-left: 24px" @click="handleExport" :loading="exporting">确认导出</t-button>
        </t-form-item>
      </t-form>
    </t-dialog>

    <!-- AI回答弹窗 -->
    <t-dialog v-model:visible="aiAnswerDialogVisible" header="AI回答" :footer="false" width="700px">
      <t-space direction="vertical" style="width: 100%" :size="16">
        <div v-if="aiAnswerData.old_answer" class="ai-section">
          <h4 style="margin-bottom: 8px">已有回答</h4>
          <div class="ai-answer-box">{{ aiAnswerData.old_answer }}</div>
        </div>
        <div class="ai-section">
          <h4 style="margin-bottom: 8px">AI生成回答</h4>
          <div class="ai-answer-box ai-answer-new">{{ aiAnswerData.ai_answer || '生成中...' }}</div>
        </div>
        <div style="text-align: right">
          <t-button variant="outline" @click="aiAnswerDialogVisible = false">关闭</t-button>
          <t-button theme="primary" style="margin-left: 12px" @click="handleReplaceAnswer" :disabled="!aiAnswerData.ai_answer">一键替换</t-button>
        </div>
      </t-space>
    </t-dialog>

    <!-- 查看原始内容弹窗 -->
    <t-dialog v-model:visible="viewOriginalDialogVisible" header="查看原始内容" :footer="false" width="700px">
      <t-space direction="vertical" style="width: 100%" :size="16">
        <div class="original-section">
          <h4 style="margin-bottom: 8px">题目</h4>
          <div class="original-content">{{ viewOriginalData.question }}</div>
        </div>
        <div v-if="viewOriginalData.model_answer" class="original-section">
          <h4 style="margin-bottom: 8px">模型回答</h4>
          <div class="original-content">{{ viewOriginalData.model_answer }}</div>
        </div>
        <div v-if="viewOriginalData.remark" class="original-section">
          <h4 style="margin-bottom: 8px">备注</h4>
          <div class="original-content">{{ viewOriginalData.remark }}</div>
        </div>
        <div style="text-align: right">
          <t-button variant="outline" @click="viewOriginalDialogVisible = false">关闭</t-button>
        </div>
      </t-space>
    </t-dialog>

    <!-- 批量设置类型弹窗 -->
    <t-dialog v-model:visible="batchTypeDialogVisible" header="批量设置类型" :footer="false" width="500px">
      <t-form :data="batchTypeForm" @submit="handleBatchTypeSubmit" label-width="100px">
        <t-form-item label="已选记录">
          <t-tag theme="primary">{{ selectedRows.length }} 条</t-tag>
        </t-form-item>
        <t-form-item label="设置类型" name="type">
          <t-input v-model="batchTypeForm.type" placeholder="输入类型，如：文本生成、图像生成" />
        </t-form-item>
        <t-form-item>
          <t-button type="submit" theme="primary">确认设置</t-button>
          <t-button variant="outline" @click="batchTypeDialogVisible = false" style="margin-left: 12px">取消</t-button>
        </t-form-item>
      </t-form>
    </t-dialog>

    <!-- 批量设置类别弹窗 -->
    <t-dialog v-model:visible="batchCategoryDialogVisible" header="批量设置类别" :footer="false" width="500px">
      <t-form :data="batchCategoryForm" @submit="handleBatchCategorySubmit" label-width="100px">
        <t-form-item label="已选记录">
          <t-tag theme="primary">{{ selectedRows.length }} 条</t-tag>
        </t-form-item>
        <t-form-item label="设置类别" name="category">
          <t-input v-model="batchCategoryForm.category" placeholder="输入类别" />
        </t-form-item>
        <t-form-item>
          <t-button type="submit" theme="primary">确认设置</t-button>
          <t-button variant="outline" @click="batchCategoryDialogVisible = false" style="margin-left: 12px">取消</t-button>
        </t-form-item>
      </t-form>
    </t-dialog>

    <!-- 重复检测弹窗 -->
    <t-dialog v-model:visible="duplicateDialogVisible" header="重复检测" width="800px" :footer="false">
      <t-space direction="vertical" style="width: 100%" :size="16">
        <t-alert v-if="duplicateData.length === 0" theme="success">未检测到重复题目</t-alert>
        <template v-else>
          <t-alert theme="warning">检测到 {{ duplicateData.length }} 组重复题目，共 {{ duplicateTotalExtra }} 条多余记录</t-alert>
          <div v-for="(group, gi) in duplicateData" :key="gi" class="dup-group">
            <div class="dup-header">
              <t-tag theme="danger" variant="light" size="small">{{ group.count }}条重复</t-tag>
              <span class="dup-question">{{ group.question }}</span>
            </div>
            <t-table :data="group.items" :columns="dupColumns" row-key="id" size="small" :max-height="200">
                <template #action="{ row }">
                  <t-radio :checked="keepIds[group.question] === row.id" @change="() => { keepIds[group.question] = row.id; }" />
                </template>
              </t-table>
          </div>
          <div style="text-align: right">
            <t-button variant="outline" @click="duplicateDialogVisible = false">关闭</t-button>
            <t-button theme="danger" style="margin-left: 12px" @click="handleRemoveDuplicates" :loading="duplicateRemoving">
              一键删除多余重复（{{ duplicateTotalExtra }}条）
            </t-button>
          </div>
        </template>
      </t-space>
    </t-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next';
import { questionsAPI } from '@/api';

const search = reactive({
  keyword: '',
  type: '',
  category: '',
  is_answered: '',
  is_refused: '',
  audit_count: '',
  audit_names: '',
});

const tableData = ref([]);
const selectedRows = ref([]);
const typeOptions = ref([]);
const categoryOptions = ref([]);
const pagination = reactive({ page: 1, pageSize: 10, total: 0 });
const refusalRate = ref('0%');

// 编辑
const editDialogVisible = ref(false);
const isEdit = ref(false);
const editId = ref(null);
const form = ref({ question: '', category: '', model_answer: '', type: '', is_answered: '-1', is_refused: '0', remark: '', audit_results: [] });
const formRules = { question: [{ required: true, message: '题目不能为空' }] };

// 导入
const importDialogVisible = ref(false);
const importStep = ref(1);
const uploadFiles = ref([]);
const parsedData = ref([]);
const importing = ref(false);
const fieldMapping = ref({});
const importSheets = ref([]);
const selectedSheet = ref('');
const importFileName = ref('');

const systemFields = [
  { value: 'question', label: '题目' },
  { value: 'category', label: '类别' },
  { value: 'type', label: '类型' },
  { value: 'model_answer', label: '模型回答' },
  { value: 'is_answered', label: '是否回答(0/1)' },
  { value: 'is_refused', label: '是否拒答(0/1)' },
  { value: 'remark', label: '备注' },
  { value: 'creator_id', label: '创建人(用户名)' },
  { value: 'response', label: '模型回答(response)' },
];
const defaultValues = ref({ is_answered: '-1', is_refused: '0' });

// 批量设置类型
const batchTypeDialogVisible = ref(false);
const batchTypeForm = reactive({ type: '' });

// 批量设置类别
const batchCategoryDialogVisible = ref(false);
const batchCategoryForm = reactive({ category: '' });

const currentSheetData = computed(() => {
  if (!selectedSheet.value || !importSheets.value.length) return null;
  return importSheets.value.find((s) => s.name === selectedSheet.value) || null;
});

const previewColumns = computed(() => {
  return systemFields
    .filter((f) => parsedData.value[0] && parsedData.value[0][f.value] !== undefined)
    .map((f) => ({ colKey: f.value, title: f.label }));
});

// 导出
const exportDialogVisible = ref(false);
const exportFormat = ref('xlsx');
const selectedExportCols = ref(['index', 'question', 'type', 'category', 'model_answer', 'is_refused', 'remark', 'audit_results']);
const selectAllExportCols = ref(true);
const exporting = ref(false);

const exportDefaultLabels = {
  index: '序号', question: '题目', type: '类型', category: '类别', model_answer: '模型回答',
  is_answered: '是否回答', is_refused: '是否拒答', remark: '备注', audit_results: '审核结果',
  creator_id: '创建人', updater_id: '更新人', created_at: '创建时间', updated_at: '更新时间',
};

const exportColumnOptions = [
  { value: 'index', label: '序号' },
  { value: 'question', label: '题目' },
  { value: 'type', label: '类型' },
  { value: 'category', label: '类别' },
  { value: 'model_answer', label: '模型回答' },
  { value: 'is_answered', label: '是否回答' },
  { value: 'is_refused', label: '是否拒答' },
  { value: 'remark', label: '备注' },
  { value: 'audit_results', label: '审核结果' },
  { value: 'creator_id', label: '创建人' },
  { value: 'updater_id', label: '更新人' },
  { value: 'created_at', label: '创建时间' },
  { value: 'updated_at', label: '更新时间' },
];

const STORAGE_KEY_EXPORT_CONFIG = 'questions_export_config';
const loadExportConfig = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_EXPORT_CONFIG);
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
};

const customExportLabels = ref({ ...exportDefaultLabels });
const hasSavedConfig = ref(false);

// 表格列配置
const STORAGE_KEY_COLS = 'questions_table_columns';
const STORAGE_KEY_WIDTHS = 'questions_table_widths';

const allColumnDefs = [
  { colKey: 'row-select', type: 'multiple', width: 50, required: true },
  { colKey: 'index', title: '序号', width: 70, required: true },
  { colKey: 'type', title: '类型', slot: 'type', width: 120 },
  { colKey: 'question', title: '题目', width: 300 },
  { colKey: 'category', title: '类别', width: 120 },
  { colKey: 'model_answer', title: '模型回答', width: 300 },
  { colKey: 'is_answered', title: '是否回答', slot: 'is_answered', width: 90 },
  { colKey: 'is_refused', title: '是否拒答', slot: 'is_refused', width: 90 },
  { colKey: 'remark', title: '备注', width: 150 },
  { colKey: 'audit_results', title: '人工审核结果', slot: 'audit_results', width: 200 },
  { colKey: 'created_at', title: '创建时间', width: 160 },
  { colKey: 'updated_at', title: '更新时间', width: 160 },
  { colKey: 'action', title: '操作', width: 280, slot: 'action', fixed: 'right', required: true },
];

// 列可见性
const columnVisibilityOptions = allColumnDefs.filter((c) => !c.required).map((c) => ({ value: c.colKey, label: c.title }));
const defaultVisibleKeys = columnVisibilityOptions.map((o) => o.value);

const loadVisibleColumns = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY_COLS)) || defaultVisibleKeys; } catch { return defaultVisibleKeys; }
};
const visibleColumns = ref(loadVisibleColumns());

const handleColumnVisibilityChange = (val) => {
  localStorage.setItem(STORAGE_KEY_COLS, JSON.stringify(val));
};

// 列宽缓存
const loadColumnWidths = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY_WIDTHS)) || {}; } catch { return {}; }
};
const savedWidths = loadColumnWidths();

const columns = computed(() => {
  return allColumnDefs
    .filter((c) => c.required || visibleColumns.value.includes(c.colKey))
    .map((c) => {
      const col = { ...c };
      if (savedWidths[c.colKey]) col.width = savedWidths[c.colKey];
      return col;
    });
});

// 列宽变化回调
const handleColumnResizeChange = (params) => {
  const { colKey, width } = params;
  savedWidths[colKey] = width;
  localStorage.setItem(STORAGE_KEY_WIDTHS, JSON.stringify(savedWidths));
};

const user = JSON.parse(localStorage.getItem('user') || '{}');

// AI回答
const aiAnswerDialogVisible = ref(false);
const aiAnswerLoading = ref({});
const aiAnswerData = ref({ ai_answer: '', old_answer: '' });
const aiAnswerRowId = ref(null);
const batchAIAnswerLoading = ref(false);

// 查看原始内容
const viewOriginalDialogVisible = ref(false);
const viewOriginalData = ref({ question: '', model_answer: '', remark: '' });

const handleAIAnswer = async (row) => {
  aiAnswerRowId.value = row.id;
  aiAnswerData.value = { ai_answer: '', old_answer: row.model_answer || '' };
  aiAnswerDialogVisible.value = true;
  aiAnswerLoading.value[row.id] = true;
  try {
    const res = await questionsAPI.aiAnswer(row.id);
    aiAnswerData.value = res.data;
  } catch (e) {
    MessagePlugin.error(e?.response?.data?.message || 'AI调用失败');
    aiAnswerDialogVisible.value = false;
  } finally {
    aiAnswerLoading.value[row.id] = false;
  }
};

const handleReplaceAnswer = async () => {
  if (!aiAnswerRowId.value || !aiAnswerData.value.ai_answer) return;
  try {
    await questionsAPI.update(aiAnswerRowId.value, {
      model_answer: aiAnswerData.value.ai_answer,
      is_answered: 1,
      updater_id: user.id,
    });
    MessagePlugin.success('替换成功');
    aiAnswerDialogVisible.value = false;
    loadData();
  } catch {}
};

const handleViewOriginal = (row) => {
  viewOriginalData.value = {
    question: row.question || '',
    model_answer: row.model_answer || '',
    remark: row.remark || '',
  };
  viewOriginalDialogVisible.value = true;
};

// 同意/撤销同意
const isUserApproved = (row) => {
  return (row.audit_results || []).some((a) => a.username === user.username);
};

const handleApprove = async (row) => {
  try {
    await questionsAPI.approve(row.id, user.username);
    MessagePlugin.success('已同意');
    loadData();
  } catch {}
};

const handleRevokeApprove = async (row) => {
  try {
    await questionsAPI.revokeApprove(row.id, user.username);
    MessagePlugin.success('已撤销同意');
    loadData();
  } catch {}
};

// 重复检测
const duplicateDialogVisible = ref(false);
const duplicateLoading = ref(false);
const duplicateRemoving = ref(false);
const duplicateData = ref([]);
const keepIds = ref({});

const duplicateTotalExtra = computed(() => {
  return duplicateData.value.reduce((sum, g) => sum + g.count - 1, 0);
});

// 单选按钮列配置
const dupColumns = [
  { colKey: 'id', title: 'ID', width: 60 },
  { colKey: 'category', title: '类别', width: 100 },
  { colKey: 'model_answer', title: '模型回答', ellipsis: true },
  { colKey: 'created_at', title: '创建时间', width: 160 },
  { colKey: 'action', title: '保留', width: 60, slot: 'action' },
];

const showDuplicateDialog = async () => {
  duplicateLoading.value = true;
  duplicateDialogVisible.value = true;
  try {
    const res = await questionsAPI.getDuplicates();
    duplicateData.value = res.data || [];
    // 默认每组保留最早（id最小）的记录
    const ids = {};
    duplicateData.value.forEach((g) => {
      ids[g.question] = Math.min(...g.items.map((item) => item.id));
    });
    keepIds.value = ids;
  } catch {} finally {
    duplicateLoading.value = false;
  }
};

const handleRemoveDuplicates = () => {
  const deleteIds = [];
  duplicateData.value.forEach((g) => {
    const keepId = keepIds.value[g.question];
    g.items.forEach((item) => {
      if (item.id !== keepId) deleteIds.push(item.id);
    });
  });
  if (deleteIds.length === 0) {
    MessagePlugin.info('没有需要删除的记录');
    return;
  }

  const dialog = DialogPlugin.confirm({
    header: '确认删除',
    body: `确定删除 ${deleteIds.length} 条重复记录吗？每组将保留选中的那条。`,
    theme: 'warning',
    confirmBtn: { content: '确认删除', theme: 'danger' },
    onConfirm: async () => {
      dialog.destroy();
      duplicateRemoving.value = true;
      try {
        await questionsAPI.removeDuplicates(deleteIds);
        MessagePlugin.success(`成功删除 ${deleteIds.length} 条重复记录`);
        duplicateDialogVisible.value = false;
        loadData();
      } catch (e) {
        MessagePlugin.error('删除失败');
      } finally {
        duplicateRemoving.value = false;
      }
    },
    onCancel: () => {
      dialog.destroy();
    },
  });
};

const loadData = async () => {
  const params = {
    keyword: search.keyword,
    page: pagination.page,
    pageSize: pagination.pageSize,
  };
  if (search.type) params.type = search.type;
  if (search.category) params.category = search.category;
  if (search.is_answered) params.is_answered = search.is_answered;
  if (search.is_refused) params.is_refused = search.is_refused;
  if (search.audit_count) params.audit_count = search.audit_count;
  if (search.audit_names) params.audit_names = search.audit_names;

  const res = await questionsAPI.list(params);
  tableData.value = res.data.list;
  pagination.total = res.data.total;
  pagination.pageSize = res.data.pageSize;
  refusalRate.value = res.data.refusal_rate;
  selectedRows.value = [];
};

const resetSearch = () => {
  search.keyword = '';
  search.type = '';
  search.category = '';
  search.is_answered = '';
  search.is_refused = '';
  search.audit_count = '';
  search.audit_names = '';
  pagination.page = 1;
  loadData();
  loadTypeOptions();
  loadCategoryOptions();
};

// 加载类型和类别选项
const loadTypeOptions = async () => {
  try {
    const res = await questionsAPI.getTypes();
    typeOptions.value = res.data;
  } catch {}
};

const loadCategoryOptions = async () => {
  try {
    const res = await questionsAPI.getCategories();
    categoryOptions.value = res.data;
  } catch {}
};

const showAddDialog = () => {
  isEdit.value = false;
  editId.value = null;
  form.value = { question: '', category: '', model_answer: '', type: '', is_answered: '-1', is_refused: '0', remark: '', audit_results: [] };
  editDialogVisible.value = true;
};

const handleEdit = (row) => {
  isEdit.value = true;
  editId.value = row.id;
  form.value = {
    question: row.question,
    category: row.category,
    model_answer: row.model_answer,
    type: row.type || '',
    is_answered: String(row.is_answered),
    is_refused: String(row.is_refused),
    remark: row.remark || '',
    audit_results: row.audit_results ? [...row.audit_results] : [],
  };
  editDialogVisible.value = true;
};

const addAudit = () => {
  form.value.audit_results.push({ name: '', result: '' });
};

const removeAudit = (index) => {
  form.value.audit_results.splice(index, 1);
};

const handleSubmit = async ({ validateResult }) => {
  if (validateResult !== true) return;
  const payload = {
    ...form.value,
    is_answered: form.value.model_answer ? Number(form.value.is_answered) : 0,
    is_refused: Number(form.value.is_refused),
  };
  try {
    if (isEdit.value) {
      await questionsAPI.update(editId.value, { ...payload, updater_id: user.id });
      MessagePlugin.success('更新成功');
    } else {
      await questionsAPI.create({ ...payload, creator_id: user.id });
      MessagePlugin.success('新增成功');
    }
    editDialogVisible.value = false;
    loadData();
  } catch {}
};

const handleDelete = (row) => {
  const dialog = DialogPlugin.confirm({
    header: '确认删除',
    body: '确定删除该题目吗？',
    theme: 'warning',
    confirmBtn: { content: '确认', theme: 'danger' },
    onConfirm: async () => {
      dialog.destroy();
      try {
        await questionsAPI.delete(row.id);
        MessagePlugin.success('删除成功');
        loadData();
      } catch {}
    },
    onCancel: () => {
      dialog.destroy();
    },
  });
};

const handleSelectChange = (value) => {
  selectedRows.value = value;
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
        await questionsAPI.batchDelete({ ids: selectedRows.value });
        MessagePlugin.success('批量删除成功');
        loadData();
      } catch {}
    },
    onCancel: () => {
      dialog.destroy();
    },
  });
};

// 批量设置类型
const showBatchTypeDialog = () => {
  batchTypeForm.type = '';
  batchTypeDialogVisible.value = true;
};

const handleBatchTypeSubmit = async () => {
  if (!batchTypeForm.type.trim()) {
    MessagePlugin.warning('请输入类型');
    return;
  }
  try {
    await questionsAPI.batchUpdateType({ ids: selectedRows.value, type: batchTypeForm.type });
    MessagePlugin.success('批量设置类型成功');
    batchTypeDialogVisible.value = false;
    loadData();
  } catch (e) {
    MessagePlugin.error('设置失败');
  }
};

// 批量设置类别
const showBatchCategoryDialog = () => {
  batchCategoryForm.category = '';
  batchCategoryDialogVisible.value = true;
};

const handleBatchCategorySubmit = async () => {
  if (!batchCategoryForm.category.trim()) {
    MessagePlugin.warning('请输入类别');
    return;
  }
  try {
    await questionsAPI.batchUpdateCategory({ ids: selectedRows.value, category: batchCategoryForm.category });
    MessagePlugin.success('批量设置类别成功');
    batchCategoryDialogVisible.value = false;
    loadData();
  } catch (e) {
    MessagePlugin.error('设置失败');
  }
};

// 批量重新回答
const batchReanswerProgress = ref({ current: 0, total: 0 });
const batchReanswerWs = ref(null);

const handleBatchAIAnswer = () => {
  if (!selectedRows.value.length) return;
  batchAIAnswerLoading.value = true;
  batchReanswerProgress.value = { current: 0, total: selectedRows.value.length };

  batchReanswerWs.value = questionsAPI.runBatchReanswerWebSocket(
    selectedRows.value,
    3,
    (progress) => {
      batchReanswerProgress.value = { current: progress.current, total: progress.total };
    },
    (result) => {
      batchAIAnswerLoading.value = false;
      MessagePlugin.success(`批量重新回答完成，成功 ${result.success}/${result.total} 条`);
      selectedRows.value = [];
      loadData();
    },
    (error) => {
      batchAIAnswerLoading.value = false;
      MessagePlugin.error(error.message || '批量回答失败');
    }
  );
};

// 导入
const showImportDialog = () => {
  importDialogVisible.value = true;
  importStep.value = 1;
  uploadFiles.value = [];
  parsedData.value = [];
  fieldMapping.value = {};
  importSheets.value = [];
  selectedSheet.value = '';
  importFileName.value = '';
  defaultValues.value = { is_answered: '-1', is_refused: '0' };
};

const handlePreviewUpload = async () => {
  if (!uploadFiles.value.length) {
    MessagePlugin.warning('请先上传文件');
    return;
  }
  importing.value = true;
  try {
    const file = uploadFiles.value[0].raw;
    const formData = new FormData();
    formData.append('file', file);

    const res = await questionsAPI.importPreview(formData);
    importSheets.value = res.data.sheets;
    importFileName.value = res.data.fileName;

    // 默认选中第一个 Sheet
    if (importSheets.value.length > 0) {
      selectedSheet.value = importSheets.value[0].name;
    }

    // 智能自动映射：根据列名相似度匹配系统字段
    autoMapFields();

    importStep.value = 2;
    MessagePlugin.success(`解析成功，发现 ${importSheets.value.length} 个工作表`);
  } catch (e) {
    MessagePlugin.error(e.message || '解析失败');
  } finally {
    importing.value = false;
  }
};

const autoMapFields = () => {
  if (!currentSheetData.value) return;
  const headers = currentSheetData.value.headers;

  // 自动映射规则：列名包含系统字段的 label 或 value 时自动匹配
  const mapping = {};
  headers.forEach((header) => {
    const h = header.toLowerCase().trim();  // 统一 trim 处理
    for (const sf of systemFields) {
      const labelMatch = sf.label.toLowerCase().replace(/[()（）/]/g, '');
      const valueMatch = sf.value.toLowerCase();
      // 精确匹配或包含匹配
      if (h === valueMatch || h === labelMatch || h.includes(valueMatch) || h.includes(labelMatch)) {
        mapping[header.trim()] = sf.value;  // 键也 trim，保持与后端一致
        break;
      }
    }
    // 额外的智能映射：识别常见字段名模式
    if (!mapping[header.trim()]) {
      if (h.includes('response') || h.includes('best_answer') || h === 'answer') {
        mapping[header.trim()] = 'model_answer';
      } else if (h.includes('question') && !h.includes('id')) {
        mapping[header.trim()] = 'question';
      }
    }
  });
  fieldMapping.value = mapping;
};

const handleSheetChange = () => {
  // 切换 Sheet 时重新自动映射
  autoMapFields();
};

const handleParseImport = async () => {
  if (!uploadFiles.value.length) {
    MessagePlugin.warning('请重新选择文件');
    importStep.value = 1;
    return;
  }
  importing.value = true;
  try {
    const file = uploadFiles.value[0].raw;
    const formData = new FormData();
    formData.append('file', file);
    // 规范化 fieldMapping 的键（trim 处理，避免列名含空格导致匹配失败）
    const normalizedMapping = {};
    Object.entries(fieldMapping.value).forEach(([k, v]) => {
      if (v) normalizedMapping[k.trim()] = v;
    });
    formData.append('fieldMapping', JSON.stringify(normalizedMapping));
    formData.append('defaultValues', JSON.stringify(defaultValues.value));
    if (selectedSheet.value) {
      formData.append('sheetName', selectedSheet.value);
    }

    const res = await questionsAPI.importFile(formData);
    parsedData.value = res.data;

    importStep.value = 3;
    MessagePlugin.success(res.message);
  } catch (e) {
    MessagePlugin.error(e.message || '解析失败');
  } finally {
    importing.value = false;
  }
};

const handleConfirmImport = async () => {
  if (!parsedData.value.length) {
    MessagePlugin.warning('没有可导入的数据');
    return;
  }
  importing.value = true;
  try {
    await questionsAPI.batchImport({ items: parsedData.value });
    MessagePlugin.success('导入成功');
    importDialogVisible.value = false;
    loadData();
  } catch (e) {
    MessagePlugin.error(e.message || '导入失败');
  } finally {
    importing.value = false;
  }
};

// 导出
const showExportDialog = () => {
  // 加载已保存的配置
  const saved = loadExportConfig();
  if (saved) {
    customExportLabels.value = saved.labels || { ...exportDefaultLabels };
    selectedExportCols.value = saved.selectedCols || ['index', 'question', 'type', 'category', 'model_answer', 'is_refused', 'remark', 'audit_results'];
    hasSavedConfig.value = true;
  } else {
    customExportLabels.value = { ...exportDefaultLabels };
    hasSavedConfig.value = false;
  }
  exportDialogVisible.value = true;
};

const toggleAllExportCols = (checked) => {
  selectedExportCols.value = checked ? exportColumnOptions.map((o) => o.value) : [];
};

const handleStashExportConfig = () => {
  const config = {
    labels: { ...customExportLabels.value },
    selectedCols: [...selectedExportCols.value],
  };
  localStorage.setItem(STORAGE_KEY_EXPORT_CONFIG, JSON.stringify(config));
  hasSavedConfig.value = true;
  MessagePlugin.success('已暂存导出配置，下次打开自动恢复');
};

const handleClearExportConfig = () => {
  localStorage.removeItem(STORAGE_KEY_EXPORT_CONFIG);
  customExportLabels.value = { ...exportDefaultLabels };
  selectedExportCols.value = ['index', 'question', 'type', 'category', 'model_answer', 'is_refused', 'remark', 'audit_results'];
  hasSavedConfig.value = false;
  MessagePlugin.success('已清除暂存的配置');
};

const handleExport = async () => {
  if (!selectedExportCols.value.length) {
    MessagePlugin.warning('请至少选择一列');
    return;
  }
  exporting.value = true;
  try {
    const columns = selectedExportCols.value.map((key) => ({
      key,
      label: customExportLabels.value[key] || exportDefaultLabels[key],
    }));
    const params = { columns, format: exportFormat.value };
    if (search.keyword) params.keyword = search.keyword;
    if (search.type) params.type = search.type;
    if (search.category) params.category = search.category;
    if (search.is_answered) params.is_answered = search.is_answered;
    if (search.is_refused) params.is_refused = search.is_refused;
    if (search.audit_count) params.audit_count = search.audit_count;
    if (search.audit_names) params.audit_names = search.audit_names;

    const res = await questionsAPI.export(params);

    const blob = new Blob([res], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'questions.' + exportFormat.value;
    a.click();
    URL.revokeObjectURL(url);
    exportDialogVisible.value = false;
    MessagePlugin.success('导出成功');
  } catch (e) {
    MessagePlugin.error(e.message || '导出失败');
  } finally {
    exporting.value = false;
  }
};

onMounted(() => {
  loadData();
  loadTypeOptions();
  loadCategoryOptions();
});
</script>

<style scoped>
.page { background: #fff; padding: 20px 24px; border-radius: 8px; height: 100%; overflow: hidden; display: flex; flex-direction: column; }
.page-title { font-size: 20px; margin-bottom: 16px; flex-shrink: 0; }
.search-bar { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; align-items: center; flex-shrink: 0; }
.refuse-rate { display: flex; align-items: center; gap: 8px; padding: 4px 12px; background: #fff2f0; border-radius: 4px; border: 1px solid #ffccc7; flex-shrink: 0; }
.rate-label { font-size: 13px; color: #cf1322; font-weight: 500; }
.toolbar { display: flex; gap: 8px; margin-bottom: 12px; flex-shrink: 0; align-items: center; }
.toolbar .refuse-rate { margin-left: auto; }
.table-wrapper { flex: 1; overflow: hidden; min-height: 0; }
.table-wrapper :deep(.t-table) { height: 100%; display: flex; flex-direction: column; }
.table-wrapper :deep(.t-table__header) { flex-shrink: 0; }
.table-wrapper :deep(.t-table__body) { flex: 1; overflow-y: auto; }
.pagination-wrapper { flex-shrink: 0; margin-top: 12px; }
.section-box { width: 100%; padding: 16px; background: #f5f5f5; border-radius: 8px; }
.section-box h4 { margin-bottom: 12px; font-size: 14px; }
.preview-table { max-height: 300px; overflow-y: auto; border: 1px solid #e7e7e7; border-radius: 4px; }
.audit-list { display: flex; flex-direction: column; gap: 8px; }
.audit-item { display: flex; gap: 8px; align-items: center; }
.raw-preview-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.raw-preview-table th, .raw-preview-table td { border: 1px solid #e7e7e7; padding: 6px 10px; text-align: left; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.raw-preview-table th { background: #f5f5f5; font-weight: 500; color: #333; }
.raw-preview-table td { color: #555; }
.column-settings { padding: 12px 16px; width: 200px; }
.column-settings h4 { margin-bottom: 10px; font-size: 14px; font-weight: 500; }
.column-settings .t-checkbox { display: block; margin-bottom: 6px; }
.ai-section h4 { font-size: 14px; font-weight: 500; color: #333; }
.ai-answer-box { padding: 12px; background: #f5f5f5; border-radius: 6px; white-space: pre-wrap; max-height: 300px; overflow-y: auto; font-size: 14px; line-height: 1.6; }
.ai-answer-new { background: #e6f7ff; border: 1px solid #91d5ff; }
.original-section h4 { font-size: 14px; font-weight: 500; color: #333; }
.original-content { padding: 12px; background: #f5f5f5; border-radius: 6px; white-space: pre-wrap; max-height: 400px; overflow-y: auto; font-size: 14px; line-height: 1.6; }
.dup-group { border: 1px solid #e7e7e7; border-radius: 6px; padding: 12px; }
.dup-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.dup-question { font-weight: 500; font-size: 14px; color: #333; }
</style>
